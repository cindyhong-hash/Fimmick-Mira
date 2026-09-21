import { NextResponse } from "next/server";
import { inpaintImageFal } from "@/lib/fal";
import { translateBriefToEnglishPrompt } from "@/lib/generate";
import { saveBuffer } from "@/lib/storage";

export const maxDuration = 180;

export async function POST(req: Request) {
  try {
    const body = await req.json() as { imageDataUrl?: string; maskDataUrl?: string; variants?: number; prompt?: string; mode?: "fill" | "remove" };
    if (!body.imageDataUrl?.startsWith("data:image/") || !body.maskDataUrl?.startsWith("data:image/")) return NextResponse.json({ error: "缺少圖片或空白區遮罩" }, { status: 400 });
    const src = Buffer.from(body.imageDataUrl.split(",")[1] ?? "", "base64");
    const sourceUrl = await saveBuffer(src, "png", "magic-fill-source-");
    const count = Math.min(4, Math.max(2, Math.round(body.variants ?? 2)));
    // 提示詞只描述「那塊要變成什麼」，而且一定是英文。
    //
    // 兩個實測踩過的坑：
    //  ・中文會被畫成字。使用者打「把花瓣移除」，模型在那塊畫出一堆看不懂的字。
    //  ・提示詞是「要畫什麼」不是「要做什麼」。同一句「把花瓣移除」裡出現了花瓣，
    //    模型就畫花瓣——說要移除反而生出更多。
    // 所以：講到移除的一律改用「把周圍場景接過去」，其餘先翻成英文再送。
    // 移除跟延伸要的是不同的提示詞。
    //
    // 一開始兩者都用「把周圍的場景接過去」，結果要移除桌上的花瓣時，周圍本來就
    // 散滿花瓣，模型忠實地又畫了一堆——語意上沒錯，但完全不是使用者要的。
    // 移除要的是「這塊本來就空無一物」，所以描述乾淨的表面，而且絕對不能提到
    // 要移除的東西（提到什麼就會畫什麼）。
    const CLEAR_SURFACE = "a clean bare surface with nothing placed on it, smooth and uninterrupted, matching the material, colour and lighting around it";
    const REMOVAL = /(移除|刪除|拿掉|去掉|清掉|不要|remove|delete|erase|clean up|get rid of)/i;
    const typed = body.prompt?.trim();
    // 按鈕給的 mode 最準；沒帶 mode 時才看字面（舊呼叫端與誤用「移除」當描述的情況）。
    const removing = body.mode === "remove" || !typed || (body.mode !== "fill" && REMOVAL.test(typed));
    const prompt = removing
      ? CLEAR_SURFACE
      : (await translateBriefToEnglishPrompt(typed!)) || CLEAR_SURFACE;
    const variants = await Promise.all(Array.from({ length: count }, () => inpaintImageFal({ imageUrl: sourceUrl, maskDataUrl: body.maskDataUrl!, prompt })));
    return NextResponse.json({ variants });
  } catch (e) {
    console.error("[magic-layers/magic-fill]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "魔術棒補空白失敗" }, { status: 500 });
  }
}
