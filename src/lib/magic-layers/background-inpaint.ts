/* ============================================================
   Magic Layers — Background reconstruction (server, fal LaMa)
   Removes the detected foreground objects from the original and inpaints the
   holes, producing a clean background plate. Set as the background layer's image
   so dragging an object reveals repaired pixels (Canva/PS-style base plate).

   Uses fal-ai/lama (object-removal inpainting; no prompt needed, available on a
   standard fal account). Opt-in per request.
   ============================================================ */
import { fal } from "@fal-ai/client";
import sharp from "sharp";
import { saveBuffer } from "@/lib/storage";
import type { Bbox } from "./types.ts";

function initFal() { const k = process.env.FAL_KEY; if (!k) throw new Error("FAL_KEY is not set"); fal.config({ credentials: k }); }
function dataUrlToBuffer(u: string): Buffer { return Buffer.from((u.split(",")[1] ?? ""), "base64"); }

/** white-on-black mask (white = remove/inpaint) over the object bboxes, dilated. */
async function buildObjectMask(objects: { bbox: Bbox }[], W: number, H: number): Promise<Buffer> {
  const rects = objects.map(o => {
    const pad = Math.round(Math.min(o.bbox.w, o.bbox.h) * 0.08);
    const x = Math.max(0, Math.round(o.bbox.x - pad)), y = Math.max(0, Math.round(o.bbox.y - pad));
    const w = Math.min(W - x, Math.round(o.bbox.w + pad * 2)), h = Math.min(H - y, Math.round(o.bbox.h + pad * 2));
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${pad}" fill="white"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="black"/>${rects}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Returns a clean-background image URL, or null if nothing to remove / on failure. */
export async function reconstructBackground(
  imageDataUrl: string,
  objects: { bbox: Bbox }[],
  W: number,
  H: number,
): Promise<string | null> {
  const removable = objects.filter(o => o.bbox.w > 4 && o.bbox.h > 4);
  if (!removable.length) return null;
  try {
    initFal();
    const imgBuf = dataUrlToBuffer(imageDataUrl);
    const maskBuf = await buildObjectMask(removable, W, H);
    const [imageUrl, maskUrl] = await Promise.all([
      fal.storage.upload(new File([new Uint8Array(imgBuf)], "img.png", { type: "image/png" })),
      fal.storage.upload(new File([new Uint8Array(maskBuf)], "mask.png", { type: "image/png" })),
    ]);
    const r = await fal.run("fal-ai/lama", { input: { image_url: imageUrl, mask_image_url: maskUrl } }) as { data?: { image?: { url?: string } }; image?: { url?: string } };
    const url = r?.data?.image?.url ?? r?.image?.url;
    if (!url) return null;
    const out = Buffer.from(await (await fetch(url)).arrayBuffer());
    return await saveBuffer(out, "png", "ml-bg-");
  } catch (e) {
    console.warn("[magic-layers] LaMa background inpaint failed:", (e as { status?: number })?.status, (e as { message?: string })?.message);
    return null;
  }
}

/**
 * 生成式填色的「移除」：用 LaMa 把框起來的東西擦掉、接回周圍的背景。
 * LaMa 只會延續周圍的紋理，不會像 flux fill 那樣在空白處「畫點東西」
 * （實測 flux 會補出一條緞帶、一塊色塊之類原本沒有的東西）。
 * 白色＝要擦掉的地方。回傳存好的圖片網址；失敗就丟錯，讓呼叫端改用別的版本。
 */
export async function eraseWithLama(imageDataUrl: string, maskDataUrl: string): Promise<string> {
  initFal();
  const [imageUrl, maskUrl] = await Promise.all([
    fal.storage.upload(new File([new Uint8Array(dataUrlToBuffer(imageDataUrl))], "img.png", { type: "image/png" })),
    fal.storage.upload(new File([new Uint8Array(dataUrlToBuffer(maskDataUrl))], "mask.png", { type: "image/png" })),
  ]);
  const r = await fal.run("fal-ai/lama", { input: { image_url: imageUrl, mask_image_url: maskUrl } }) as { data?: { image?: { url?: string } }; image?: { url?: string } };
  const url = r?.data?.image?.url ?? r?.image?.url;
  if (!url) throw new Error("LaMa 沒有回傳圖片");
  const res = await fetch(url);
  if (!res.ok) throw new Error("LaMa 結果下載失敗");
  return saveBuffer(Buffer.from(await res.arrayBuffer()), "png", "magic-fill-erase-");
}
