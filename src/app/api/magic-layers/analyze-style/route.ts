/* ============================================================
   POST /api/magic-layers/analyze-style
   分析「文字參考圖」的 Typography，回傳結構化 JSON（不自行新增效果）。
   核心原則：Similarity > Decoration —— 以「還原參考圖」為第一優先，
   參考圖沒出現的效果一律 enabled:false。
   Body: { refImageUrl, availableFonts? }
   Returns: StyleAnalysis JSON | { error }
   需要 OPENROUTER_API_KEY。
   ============================================================ */
import { NextResponse } from "next/server";
import { describeImageOpenRouter } from "@/lib/openrouter";

export const maxDuration = 60;

const DEFAULT_FONTS = ["Noto Sans TC", "Noto Serif TC", "Manrope"];

const SYSTEM = `你是一個專業 Typography Designer。
你的任務不是替文字創造新的藝術效果，而是分析使用者提供的參考圖片，盡可能還原圖片中的文字設計。
請優先分析 Typography 本身，而不是裝飾效果。

分析順序：
1. Font category  2. Font weight  3. Font width  4. Letter spacing  5. Line height
6. Font color  7. Stroke  8. Shadow  9. Gradient  10. Glow / special effects

重要原則（最重要的判斷規則：Similarity > Decoration）：
- Reference image 中沒有明確出現的效果，請保持關閉（enabled:false）。
- DO NOT invent visual effects。不要為了增加設計感，自動加入 outline / drop shadow / gradient / glow / emboss / 3D / neon。
- 沒有描邊 → stroke.enabled=false；沒有陰影 → shadow.enabled=false；沒有漸層 → gradient.enabled=false；沒有立體 → 不要 3D/emboss；沒有發光 → glow.enabled=false。
- 如果圖片主要特色來自字型本身，就只透過 font family / weight / width / letter spacing / color 來還原。
- 判斷字體時注意：Serif/Sans、明朝體/黑體、橫細豎粗、字面大小、字體寬窄、筆畫粗細、中文重心、字距、印刷感。
- 顏色請以「字本身筆畫的填色」為準，不要把背景色當成字色。
- 最終目標是「看起來像參考圖」，而不是「看起來比較華麗」。

font.category 從：sans-serif / serif / ming / gothic / rounded / handwritten / calligraphy / display / condensed / geometric 擇一。
font.weight 數值：Thin=100 Light=300 Regular=400 Medium=500 SemiBold=600 Bold=700 ExtraBold=800 Black=900。
font.width 從：condensed / slightly-condensed / normal / slightly-expanded / expanded 擇一。
letterSpacing 用 em 字串（範圍 -0.1em ~ 0.2em）。lineHeight 為數字（單行給 1）。

只輸出下面這個 JSON schema，不要任何多餘文字或 markdown code fence：
{
  "styleName": string,
  "confidence": number,
  "visualDescription": string,
  "font": { "category": string, "suggestedFamily": string, "fallbackFamilies": string[], "weight": number, "width": string },
  "typography": { "fontSizeScale": number, "letterSpacing": string, "lineHeight": number, "color": string, "textAlign": "left"|"center"|"right" },
  "stroke": { "enabled": boolean, "color": string, "width": number },
  "shadow": { "enabled": boolean, "color": string, "offsetX": number, "offsetY": number, "blur": number },
  "gradient": { "enabled": boolean, "type": "linear"|"radial", "angle": number, "colors": string[] },
  "glow": { "enabled": boolean, "color": string, "blur": number },
  "italic": boolean,
  "underline": boolean
}`;

export async function POST(request: Request) {
  try {
    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: "缺少 OPENROUTER_API_KEY（分析字體需要）" }, { status: 400 });
    const { refImageUrl, availableFonts } = await request.json();
    if (typeof refImageUrl !== "string" || !/^(data:image\/|https?:\/\/|\/)/.test(refImageUrl)) {
      return NextResponse.json({ error: "缺少參考圖" }, { status: 400 });
    }
    const fonts: string[] = Array.isArray(availableFonts) && availableFonts.length ? availableFonts : DEFAULT_FONTS;

    const prompt =
      SYSTEM +
      `\n\nAvailable fonts:\n${fonts.join("\n")}\n\n` +
      `You MUST select "suggestedFamily" from this list. Do not generate fonts that are unavailable (例如 華康儷宋 / 游明朝 / 筑紫明朝 皆不可用). ` +
      `"fallbackFamilies" 也只能用清單內字體或通用 serif/sans-serif。現在只輸出 JSON。`;

    const raw = await describeImageOpenRouter(refImageUrl, prompt, 900);
    if (!raw) return NextResponse.json({ error: "分析失敗，請重試" }, { status: 502 });

    // 容錯解析：抽出第一個 {...} JSON 區塊
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s < 0 || e <= s) return NextResponse.json({ error: "分析結果格式無法解析" }, { status: 502 });
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(cleaned.slice(s, e + 1)); }
    catch { return NextResponse.json({ error: "分析結果格式無法解析" }, { status: 502 }); }

    // 保證 suggestedFamily 一定落在可用清單內
    const font = (parsed.font ?? {}) as Record<string, unknown>;
    if (typeof font.suggestedFamily !== "string" || !fonts.includes(font.suggestedFamily)) {
      const cat = String(font.category ?? "").toLowerCase();
      font.suggestedFamily = /serif|ming|song|明|宋/.test(cat) ? "Noto Serif TC" : "Noto Sans TC";
      parsed.font = font;
    }
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[magic-layers/analyze-style] failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
