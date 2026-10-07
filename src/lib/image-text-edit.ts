/* ============================================================
   圖上文字微調（多圖微調畫布的「改文字」模式）

   AI 生成的圖，字是直接畫在圖裡的，不是可以改的文字圖層。
   做法：先讓 AI 把圖上的字一段一段讀出來列成清單，使用者直接在清單裡改，
   再把「哪段改成什麼」一次交給生圖模型，只重畫那幾段字，其他地方不動。
   比原本「框選＋描述想改什麼」準：模型不用猜要改哪段，也不用猜新內容。
   ============================================================ */

export type TextEdit = { from: string; to: string };

/** 讀圖上文字最多列幾段：海報上通常不到 10 段，太多多半是把小字、商品包裝上的字也讀進來了。 */
export const MAX_TEXT_BLOCKS = 12;

/**
 * 把模型回的字串整理成文字清單。
 * 模型偶爾會包 ```json、多講一句話、或直接一行一段，都要能讀；讀不到就回空陣列。
 */
export function parseImageTextBlocks(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let items: unknown[] | null = null;
  const start = raw.indexOf("["), end = raw.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(parsed)) items = parsed;
    } catch { /* 不是合法 JSON → 改用一行一段 */ }
  }
  if (!items) items = raw.replace(/```[a-z]*|```/gi, "").split("\n");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const text = (typeof it === "string" ? it : typeof it === "object" && it && "text" in it ? String((it as { text: unknown }).text) : "")
      .replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, "")   // 一行一段時常見的「- 」「1. 」開頭
      .replace(/^["「『]|["」』]$/g, "")
      .trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= MAX_TEXT_BLOCKS) break;
  }
  return out;
}

/** 對照讀出來的原文和使用者改過的清單，挑出真的有改的那幾段（清空＝把那段字拿掉）。 */
export function collectTextEdits(original: string[], current: string[]): TextEdit[] {
  return original
    .map((from, i) => ({ from, to: (current[i] ?? from).trim() }))
    .filter((e) => e.to !== e.from);
}

/** 給生圖模型的指令：逐段列出「原文 → 新文字」，新文字逐字拼出來，避免模型自己改寫或縮短。 */
export function buildTextEditPrompt(edits: TextEdit[]): string {
  const lines = edits.map((e, i) => {
    if (!e.to) return `${i + 1}. REMOVE the text "${e.from}" completely, and fill its area with the surrounding background so it looks like it was never there.`;
    const spelled = e.to.split("").map((c) => `"${c}"`).join(" ");
    return `${i + 1}. Replace the text "${e.from}" with EXACTLY "${e.to}" (characters in order: ${spelled}).`;
  });
  return (
    `You are given an advertisement image. Change ONLY the text listed below; everything else must stay exactly the same.\n\n` +
    `TEXT CHANGES:\n${lines.join("\n")}\n\n` +
    `ABSOLUTE RULES:\n` +
    `- Each new text must be reproduced character by character exactly as given — not paraphrased, shortened, translated, or converted between Traditional and Simplified Chinese.\n` +
    `- Keep each changed text in the same position, and with the same font style, weight, color, size, shadow and effects as the original text it replaces. If the new text is longer, shrink it slightly to fit the same area rather than overflowing.\n` +
    `- Every other piece of text in the image must remain 100% identical. Do not duplicate any text.\n` +
    `- People, products, background, lighting and composition must be pixel identical. Same image size and aspect ratio.\n\n` +
    `OUTPUT: the same image with only the listed text changes applied.`
  );
}
