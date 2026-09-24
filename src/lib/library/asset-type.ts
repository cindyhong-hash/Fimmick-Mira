/* ============================================================
   素材庫分類（assetType）——跟「生成時的角色」分開

   商品套組生成時每張圖有自己的角色（generationRole：主圖、質地、背景、裝飾…），
   素材庫生成也有生成類型（genType：scene／person／illustration）。
   這些是「怎麼生出來的」，不是「圖裡是什麼」：用背景生成器畫出一個卡通頭像，
   以前就會被標成「背景」；商品套組的背景、質地、裝飾也一律被標成「產品成圖」。

   所以另外存一個 assetType：
     ・生成完成後由 AI 看圖決定（source = "ai"）
     ・使用者可以在圖片詳細視窗手動改（source = "user"），改過之後 AI 不再覆蓋
     ・都存在 LibraryImage.paramsJson 裡，不改資料庫結構
     ・沒有 assetType 的舊素材照原本的規則顯示（genType 推回去）

   這個檔案沒有 DOM、沒有資料庫，伺服器和瀏覽器都用它。
   ============================================================ */

/** 跟素材庫篩選列的 key 一樣：參考圖／背景／人像／插畫／產品成圖。 */
export type AssetType = "uploaded" | "material" | "person" | "illustration" | "product";
export type AssetTypeSource = "ai" | "user";

export const ASSET_TYPES: AssetType[] = ["material", "product", "person", "illustration", "uploaded"];
export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  material: "背景", product: "產品成圖", person: "人像", illustration: "插畫", uploaded: "參考圖",
};

export const isAssetType = (v: unknown): v is AssetType => typeof v === "string" && (ASSET_TYPES as string[]).includes(v);

function parse(paramsJson: string | null | undefined): Record<string, unknown> {
  try { const p = JSON.parse(paramsJson || "{}"); return p && typeof p === "object" ? p : {}; } catch { return {}; }
}

/** 讀出明確存下的分類（沒有就是 null，呼叫端退回原本的推法）。 */
export function readAssetType(paramsJson: string | null | undefined): { type: AssetType; source: AssetTypeSource } | null {
  const p = parse(paramsJson);
  return isAssetType(p.assetType) ? { type: p.assetType, source: p.assetTypeSource === "user" ? "user" : "ai" } : null;
}

/** 把分類寫進 paramsJson（其他欄位原樣保留）。 */
export function withAssetType(paramsJson: string | null | undefined, type: AssetType, source: AssetTypeSource): string {
  return JSON.stringify({ ...parse(paramsJson), assetType: type, assetTypeSource: source });
}

/**
 * paramsJson 被整份覆寫時（素材庫「挑一張留下」會這樣做），把舊的分類帶過去，
 * 不然 AI 剛判斷好的分類、使用者改過的分類都會被洗掉。新內容自己有帶分類就用新的。
 */
export function keepAssetType(previous: string | null | undefined, next: string): string {
  const old = readAssetType(previous);
  if (!old) return next;
  const p = parse(next);
  if (isAssetType(p.assetType)) return next;
  return JSON.stringify({ ...p, assetType: old.type, assetTypeSource: old.source });
}

/**
 * 解析看圖 AI 的回覆。只接受 JSON 裡的 type（或整段回覆就是一個分類字），
 * 容許模型用中文標籤或常見同義字；看不懂就回 null（不分類，照舊規則顯示）。
 */
export function parseAssetTypeReply(text: string): AssetType | null {
  const alias: Record<string, AssetType> = {
    background: "material", scene: "material", material: "material", 背景: "material",
    product: "product", "product-photo": "product", 產品: "product", 產品成圖: "product", 產品圖: "product",
    person: "person", people: "person", human: "person", portrait: "person", 人像: "person",
    illustration: "illustration", drawing: "illustration", cartoon: "illustration", 插畫: "illustration",
    reference: "uploaded", design: "uploaded", uploaded: "uploaded", 參考圖: "uploaded",
  };
  const pick = (v: unknown) => (typeof v === "string" ? alias[v.trim().toLowerCase()] ?? null : null);
  const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    const j = JSON.parse(cleaned) as { type?: unknown; category?: unknown; assetType?: unknown };
    return pick(j.type) ?? pick(j.category) ?? pick(j.assetType);
  } catch {
    return pick(cleaned);
  }
}
