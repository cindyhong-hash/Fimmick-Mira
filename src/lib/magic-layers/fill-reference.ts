/* ============================================================
   生成式填色＋參考圖：在框起來的那塊放進「長得像參考圖的東西」。

   原本的填色（FLUX fill）只看文字、不看圖，所以有參考圖時換一條路：
   1. 把框連同周圍一圈裁下來（模型要看到周圍，光線、角度才接得上）。
   2. 裁下來的圖＋參考圖一起給 nano-banana edit，跟它說「在第 1 張的某某範圍裡，放進第 2 張那樣的東西」。
   3. 結果縮回裁切的大小、貼回原圖，回傳整張（編輯器只會取框裡那塊、邊緣再羽化，框外完全不動）。
   這裡放純函式（範圍、提示詞），呼叫模型和貼圖在路由裡。
   ============================================================ */

export type Box = { x: number; y: number; w: number; h: number };

/** 框外多裁一圈當周圍環境：每邊加框寬／高的一半（至少 64px），不超出整張圖。 */
export function contextBox(box: Box, W: number, H: number): { left: number; top: number; width: number; height: number } {
  const mx = Math.max(64, box.w * 0.5), my = Math.max(64, box.h * 0.5);
  const left = Math.max(0, Math.floor(box.x - mx)), top = Math.max(0, Math.floor(box.y - my));
  const right = Math.min(W, Math.ceil(box.x + box.w + mx)), bottom = Math.min(H, Math.ceil(box.y + box.h + my));
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

/** 框在裁切範圍裡的位置（百分比，四捨五入），寫進提示詞告訴模型要改哪一塊。 */
export function boxPercent(box: Box, crop: { left: number; top: number; width: number; height: number }) {
  const p = (v: number, total: number) => Math.max(0, Math.min(100, Math.round((v / total) * 100)));
  return {
    x0: p(box.x - crop.left, crop.width), x1: p(box.x + box.w - crop.left, crop.width),
    y0: p(box.y - crop.top, crop.height), y1: p(box.y + box.h - crop.top, crop.height),
  };
}

/**
 * 給 nano-banana 的提示詞（看得懂中文，使用者的原話直接放進去）。
 * 一定要講清楚：第 1 張是要改的、只改那個範圍、第 2 張只是參考；不然它會整張重畫或把參考圖照搬。
 */
export function buildRefFillPrompt(request: string, at: ReturnType<typeof boxPercent>): string {
  const where = `the region from ${at.x0}% to ${at.x1}% of the width (from the left) and from ${at.y0}% to ${at.y1}% of the height (from the top)`;
  const what = request
    ? `The user's request (may be in Chinese): "${request}".`
    : "Put something that looks like the main subject of the second image there.";
  return `Edit the FIRST image only inside ${where}. Use the SECOND image as the visual reference for what should appear there. ${what} ` +
    "Match the first image's lighting, perspective, scale and colour so it blends in naturally. " +
    "Keep everything outside that region exactly the same. Do not change the image size or framing. Do not copy any text or logos from the reference.";
}
