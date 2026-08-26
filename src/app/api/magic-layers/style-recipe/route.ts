/* ============================================================
   POST /api/magic-layers/style-recipe
   分析「文字參考圖」的視覺風格 → 輸出 Style Recipe（純樣式 JSON，不含文字內容）。
   前端會用真字體把使用者文字 render 出來、再套這份 recipe → 中文字形永遠正確。
   Body: { refImageUrl, instruction?, currentRecipe? }
     - instruction+currentRecipe：AI 微調（在現有 recipe 上照指令調整）
   Returns: StyleRecipe JSON | { error }
   需要 OPENROUTER_API_KEY。
   ============================================================ */
import { NextResponse } from "next/server";
import { describeImageOpenRouter } from "@/lib/openrouter";

export const maxDuration = 60;

const SCHEMA = `{
  "fontCategory": "serif" | "ming" | "sans" | "gothic" | "rounded",
  "color": "#RRGGBB",                       // 主文字填色（若非漸層）
  "gradient": ["#RRGGBB","#RRGGBB"] | null, // 主文字上→下漸層；無則 null
  "strokeColor": "#RRGGBB" | null,          // 外框顏色；無外框則 null
  "strokeWidth": 0.02~0.16,                 // 外框粗細（佔字高比例）
  "shadowColor": "rgba(r,g,b,a)" | "#RRGGBB" | null,  // 投影色；無投影則 null
  "shadowDx": -0.3~0.3, "shadowDy": -0.3~0.3, "shadowBlur": 0~0.4,  // 投影位移/模糊（比例）
  "secondaryColor": "#RRGGBB" | null,       // 第二層位移副本顏色（雙色/立體感）；無則 null
  "secondaryDx": -0.4~0.4, "secondaryDy": -0.4~0.4,   // 第二層位移（比例）
  "skew": -20~20                            // 水平傾斜角度（度），無則 0
}`;

const SYSTEM =
  `你是專業 Typography Designer。分析參考圖中「文字本身」的視覺風格，輸出可套用到「其他文字」的 Style Recipe。\n` +
  `重要原則：\n` +
  `- 只描述樣式，完全忽略參考圖裡是什麼字（不要輸出任何文字內容）。\n` +
  `- 顏色以「字筆畫的填色」為準，不要抓背景色。若字是漸層，gradient 給 上→下 兩個色；否則 gradient=null、用 color。\n` +
  `- 沒有的效果一律給 null / 0（沒外框 strokeColor=null；沒投影 shadowColor=null；沒有第二層 secondaryColor=null；不傾斜 skew=0）。不要無中生有。\n` +
  `- 若字有明顯「雙色/立體」（例如主色下方有另一色的位移副本），把第二層色放 secondaryColor 並給位移。\n` +
  `- fontCategory 依字形判斷（明體/宋體=ming、黑體/無襯線=sans、圓體=rounded、襯線=serif）。\n` +
  `只輸出下列 JSON schema，不要任何多餘文字或 markdown：\n${SCHEMA}`;

export async function POST(request: Request) {
  try {
    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: "缺少 OPENROUTER_API_KEY（分析風格需要）" }, { status: 400 });
    const { refImageUrl, instruction, currentRecipe } = await request.json();
    if (typeof refImageUrl !== "string" || !/^(data:image\/|https?:\/\/|\/)/.test(refImageUrl)) {
      return NextResponse.json({ error: "缺少參考圖" }, { status: 400 });
    }

    const tweak = typeof instruction === "string" && instruction.trim()
      ? `\n\n這是「微調」：以下是目前的 recipe：\n${JSON.stringify(currentRecipe ?? {})}\n請只依這句指令調整對應欄位，其餘盡量維持：「${instruction.trim()}」。仍只輸出完整 JSON。`
      : "";
    const raw = await describeImageOpenRouter(refImageUrl, SYSTEM + tweak, 700);
    if (!raw) return NextResponse.json({ error: "分析失敗，請重試" }, { status: 502 });

    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
    if (s < 0 || e <= s) return NextResponse.json({ error: "分析結果格式無法解析" }, { status: 502 });
    try { return NextResponse.json(JSON.parse(cleaned.slice(s, e + 1))); }
    catch { return NextResponse.json({ error: "分析結果格式無法解析" }, { status: 502 }); }
  } catch (err) {
    console.error("[magic-layers/style-recipe] failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
