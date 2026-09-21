import { NextResponse } from "next/server";
import sharp from "sharp";
import { inpaintImageFal } from "@/lib/fal";
import { describeSceneInEnglish } from "@/lib/generate";
import { saveBuffer } from "@/lib/storage";
import { findBlankRegion } from "@/lib/magic-layers/blank-region";

export const maxDuration = 180;

type Direction = "auto" | "left" | "right" | "top" | "bottom" | "center";
const RATIOS: Record<string, [number, number]> = { "1:1": [1, 1], "4:5": [4, 5], "9:16": [9, 16], "16:9": [16, 9] };

export async function POST(req: Request) {
  try {
    const body = await req.json() as { imageDataUrl?: string; width?: number; height?: number; ratio?: string; direction?: Direction; mode?: "keep" | "recompose"; variants?: number; prompt?: string };
    if (!body.imageDataUrl?.startsWith("data:image/")) return NextResponse.json({ error: "缺少畫布圖片" }, { status: 400 });
    const W = Math.max(1, Math.round(body.width ?? 0)), H = Math.max(1, Math.round(body.height ?? 0));
    const [rw, rh] = RATIOS[body.ratio ?? ""] ?? RATIOS["4:5"];
    let targetW = W, targetH = H;
    if (W / H < rw / rh) targetW = Math.ceil(H * rw / rh); else targetH = Math.ceil(W * rh / rw);
    const direction = body.direction ?? "auto";
    let left = Math.floor((targetW - W) / 2), top = Math.floor((targetH - H) / 2);
    if (direction === "left") left = targetW - W;
    if (direction === "right") left = 0;
    if (direction === "top") top = targetH - H;
    if (direction === "bottom") top = 0;
    const src = Buffer.from(body.imageDataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64");

    // 畫布裡面的空白也要補，不是只補畫布外面新加的那圈。
    //
    // 原本的遮罩把整個原畫布塗黑（＝保留），所以使用者「把背景圖縮小、想讓它往
    // 旁邊長」的時候，那片白邊在原畫布裡面，模型不准動它，結果就是白的留在那裡。
    // 現在改成先找出與邊緣相連的空白，它跟畫布外新增的區域一起算成要補的地方。
    const blank = await findBlankRegion(src);
    const content = blank.content ?? { left: 0, top: 0, width: W, height: H };

    // 遮罩：白＝補、黑＝保留。只有「有畫面內容」的像素保留。
    const maskPixels = Buffer.alloc(blank.width * blank.height);
    for (let i = 0; i < maskPixels.length; i += 1) maskPixels[i] = blank.fill[i] ? 255 : 0;
    const innerMask = await sharp(maskPixels, { raw: { width: blank.width, height: blank.height, channels: 1 } })
      .png().toBuffer();
    const mask = await sharp({ create: { width: targetW, height: targetH, channels: 3, background: "white" } })
      .composite([{ input: innerMask, left, top }]).png().toBuffer();

    // 要補的地方先鋪一層模糊底，而不是純灰或純白。
    //
    // 純灰等於沒有任何線索，模型很容易回一片平色；留著原本的白邊更糟，等於一直
    // 提示它「這裡是白的」。所以只拿真正有內容的那一塊放大模糊當底，新區域一開始
    // 就有大致正確的顏色與明暗走向。這是 outpaint 的標準前處理。
    const contentCrop = await sharp(src).extract(content).toBuffer();
    const blurred = await sharp(contentCrop)
      .resize(targetW, targetH, { fit: "cover", position: "centre" })
      .blur(Math.max(8, Math.round(Math.max(targetW, targetH) / 40)))
      .toBuffer();
    const padded = await sharp(blurred)
      .composite([{ input: contentCrop, left: left + content.left, top: top + content.top }])
      .png().toBuffer();
    const paddedUrl = await saveBuffer(padded, "png", "outpaint-source-");
    const maskDataUrl = `data:image/png;base64,${mask.toString("base64")}`;
    const count = Math.min(4, Math.max(2, Math.round(body.variants ?? 2)));
    // 提示詞只能描述「那個場景是什麼」，不能下指令、不能提顏色、不能提照片。
    //
    // FLUX Fill 把提示詞當成「要畫什麼」而不是「怎麼做」，踩過兩次：
    //   ・寫 "every **white** masked area" → 補出一整片白邊
    //   ・改成 "Extend this **photograph** into one larger continuous **photo**"
    //     → 補的區域真的畫出一格一格的照片，還自己編了停車場
    // 所以改成先看一次原圖，拿到一句英文的場景描述當提示詞，把模型壓在同一個
    // 場景裡。看圖失敗就退回一句同樣不含上述禁詞的泛用描述。
    const sceneHint = body.prompt?.trim()
      // 看的是裁到內容之後的圖：整張送進去的話，縮小後留下的白邊也會被描述成
      // 「白色背景」，等於又把顏色詞餵回提示詞。
      || await describeSceneInEnglish(`data:image/png;base64,${(await sharp(contentCrop).png().toBuffer()).toString("base64")}`, new URL(req.url).origin);
    const prompt = sceneHint
      || "the same room continuing outward, with the same walls, furniture, surfaces and daylight";
    const urls = await Promise.all(Array.from({ length: count }, () => inpaintImageFal({ imageUrl: paddedUrl, maskDataUrl, prompt })));
    return NextResponse.json({ variants: urls, targetW, targetH, offsetX: left, offsetY: top });
  } catch (e) {
    console.error("[magic-layers/outpaint]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "擴圖失敗" }, { status: 500 });
  }
}
