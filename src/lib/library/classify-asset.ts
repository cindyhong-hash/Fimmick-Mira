/* ============================================================
   素材生成完成後，看圖決定素材庫分類（只在伺服器用）

   用便宜的看圖模型（跟素材庫「描述圖片」同一個，預設 gpt-5.4-nano），
   圖先縮到 512px 再送，一張約零點幾毛、幾秒鐘。
   失敗、看不懂、逾時都不要緊：不寫分類，素材庫照原本的規則顯示。
   使用者手動改過的分類（source = "user"）永遠不覆蓋。
   ============================================================ */
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { parseAssetTypeReply, readAssetType, withAssetType, type AssetType } from "./asset-type.ts";

const MODEL = process.env.OPENROUTER_VISION_MODEL ?? "openai/gpt-5.4-nano";

const PROMPT = `You are sorting images in a marketing asset library. Look at the image and choose ONE category by what the image actually shows:
- "background": a scene, backdrop, texture, pedestal/stage or surface with NO product and NO person as the subject (decorative props like flowers are fine).
- "product": a product (bottle, jar, package, item) is the subject — a product shot, a cut-out product, or a product placed in a scene.
- "person": a real, photographic human is the subject.
- "illustration": drawn / 2D / cartoon / vector / 3D-cartoon artwork (characters, icons, motifs), not a photo.
- "reference": a finished ad or social-media design with a text layout (headline, prices, badges).
Reply with JSON only: {"type":"background|product|person|illustration|reference"}`;

async function loadSmall(imageUrl: string): Promise<string | null> {
  let buf: Buffer;
  if (/^https?:\/\//.test(imageUrl)) {
    const r = await fetch(imageUrl, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    buf = Buffer.from(await r.arrayBuffer());
  } else if (imageUrl.startsWith("data:")) {
    buf = Buffer.from(imageUrl.split(",")[1] ?? "", "base64");
  } else if (imageUrl.startsWith("/")) {
    // 本機 /uploads：只准讀 public 資料夾裡面的檔案（擋掉 /../../.env 這種路徑）
    const root = path.join(process.cwd(), "public");
    const file = path.resolve(root, "." + imageUrl.split("?")[0]);
    if (!file.startsWith(root + path.sep)) return null;
    buf = await readFile(file);
  } else return null;
  const small = await sharp(buf).resize(512, 512, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer();
  return `data:image/jpeg;base64,${small.toString("base64")}`;
}

/** 看一張圖回傳分類；任何失敗都回 null。 */
export async function classifyAssetImage(imageUrl: string): Promise<AssetType | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  try {
    const image = await loadSmall(imageUrl);
    if (!image) return null;
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(25_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Marketing Tool" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 40,
        messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: image } }, { type: "text", text: PROMPT }] }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return parseAssetTypeReply(String(data?.choices?.[0]?.message?.content ?? ""));
  } catch (e) {
    console.warn("[library/classify-asset]", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 替一張已完成的素材補上分類。已經有分類的不重做（除非 force——圖換了，例如重新生成）；
 * 使用者手動改過的永遠不動。寫入前再讀一次，避免蓋掉這段時間裡別人改的東西。
 */
export async function classifyAndStoreAssetType(rowId: string, opts: { force?: boolean } = {}): Promise<void> {
  try {
    const row = await db.libraryImage.findUnique({ where: { id: rowId }, select: { status: true, imageUrl: true, paramsJson: true } });
    if (!row || row.status !== "DONE" || !row.imageUrl) return;
    const existing = readAssetType(row.paramsJson);
    if (existing?.source === "user" || (existing && !opts.force)) return;
    const type = await classifyAssetImage(row.imageUrl);
    if (!type) return;
    const latest = await db.libraryImage.findUnique({ where: { id: rowId }, select: { imageUrl: true, paramsJson: true } });
    if (!latest || latest.imageUrl !== row.imageUrl || readAssetType(latest.paramsJson)?.source === "user") return;
    await db.libraryImage.update({ where: { id: rowId }, data: { paramsJson: withAssetType(latest.paramsJson, type, "ai") } });
  } catch (e) {
    console.warn("[library/classify-asset] store failed:", e instanceof Error ? e.message : e);
  }
}

/** 替一整批（商品套組）補分類：同時跑，整體最多等 timeoutMs，超過就算了（照舊規則顯示）。 */
export async function classifyBatchAssets(batchId: string, timeoutMs = 20_000): Promise<void> {
  try {
    const rows = await db.libraryImage.findMany({ where: { batchId, status: "DONE" }, select: { id: true } });
    await Promise.race([
      Promise.all(rows.map((r) => classifyAndStoreAssetType(r.id))),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch (e) {
    console.warn("[library/classify-asset] batch failed:", e instanceof Error ? e.message : e);
  }
}

/** 重新生成一張之前先記下使用者改過的分類；重新生成會整份覆寫 paramsJson。 */
export async function readUserAssetType(rowId: string): Promise<AssetType | null> {
  const row = await db.libraryImage.findUnique({ where: { id: rowId }, select: { paramsJson: true } }).catch(() => null);
  const t = readAssetType(row?.paramsJson);
  return t?.source === "user" ? t.type : null;
}

/** 重新生成完：使用者改過的分類寫回去；沒改過就依新圖重新判斷。 */
export async function restoreOrReclassify(rowId: string, userType: AssetType | null): Promise<void> {
  if (!userType) return classifyAndStoreAssetType(rowId, { force: true });
  try {
    const row = await db.libraryImage.findUnique({ where: { id: rowId }, select: { paramsJson: true } });
    if (row) await db.libraryImage.update({ where: { id: rowId }, data: { paramsJson: withAssetType(row.paramsJson, userType, "user") } });
  } catch (e) {
    console.warn("[library/classify-asset] restore failed:", e instanceof Error ? e.message : e);
  }
}
