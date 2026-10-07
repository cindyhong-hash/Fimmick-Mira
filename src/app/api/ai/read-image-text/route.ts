import { protectPaidRoute } from "@/lib/site-gate";
import { dailyQuota } from "@/lib/paid-quota";
import { NextResponse } from "next/server";
import { loadBuffer, contentTypeForExt } from "@/lib/storage";
import { parseImageTextBlocks } from "@/lib/image-text-edit";

/* POST /api/ai/read-image-text  { imageUrl } → { blocks: string[] }
   把圖上的字一段一段讀出來，給多圖微調畫布的「改文字」模式列成清單（見 src/lib/image-text-edit.ts）。 */

// 讀圖的 LLM 呼叫可能超過 Vercel 預設的 10 秒
export const maxDuration = 60;

// 讀中文海報字用 Gemini：預設的 gpt-4o-mini 常把繁體字讀錯或讀成簡體
const MODEL = process.env.OPENROUTER_OCR_MODEL ?? "google/gemini-2.5-flash";

const PROMPT =
  "List every piece of marketing text that is visibly printed on this advertisement image (headlines, subtitles, prices, labels, call-to-action buttons). " +
  "Keep each visual text block as one item, in reading order from top to bottom. Copy the characters exactly as shown — keep Traditional Chinese as Traditional, keep punctuation and numbers. " +
  "Skip tiny text printed on the product packaging itself. " +
  'Output ONLY a JSON array of strings, e.g. ["主標題", "副標題"]. If there is no text, output [].';

async function handlePost(request: Request) {
  try {
    const { imageUrl } = (await request.json()) as { imageUrl?: string };
    if (!imageUrl) return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY not set" }, { status: 500 });

    const buf = await loadBuffer(imageUrl);
    const ext = imageUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
    const dataUrl = `data:${contentTypeForExt(ext)};base64,${buf.toString("base64")}`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Marketing Tool" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        temperature: 0,
        messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: dataUrl } }, { type: "text", text: PROMPT }] }],
      }),
    });
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[]; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message ?? `OpenRouter ${res.status}`);
    return NextResponse.json({ blocks: parseImageTextBlocks(data.choices?.[0]?.message?.content) });
  } catch (err) {
    console.error("[POST /api/ai/read-image-text]", err);
    return NextResponse.json({ error: "讀取圖上文字失敗，請稍後再試" }, { status: 500 });
  }
}

// 會花 AI 費用：跟其他文字類 AI 功能共用每日上限
export const POST = protectPaidRoute(handlePost, { quota: dailyQuota("ai-text") });
