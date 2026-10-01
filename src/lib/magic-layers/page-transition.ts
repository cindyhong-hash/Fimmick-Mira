/* ============================================================
   多頁接成一支影片時，頁跟頁之間的過場（淡入淡出、推移、翻頁掀開、縮放）。

   每一頁有自己的長度；過場記在「後面那一頁」上（transitionIn＝怎麼從上一頁換到這一頁），
   而且跟上一頁的尾巴重疊：過場期間上一頁還在播最後幾格、這一頁的動畫已經開始。
   這裡只算時間與位置（純數字），真正畫出來在編輯器裡（預覽和輸出 MP4 共用）。
   位置都是畫面寬高的比例：dx = 1 就是往右一整個畫面寬。
   ============================================================ */

export type TransitionKind = "none" | "fade" | "dipBlack" | "dipWhite" | "additive" | "nonAdditive" | "filmDissolve" | "push" | "wipe" | "zoom";
export type TransitionDir = "left" | "right" | "up" | "down";
export type PageTransition = { kind: TransitionKind; duration: number; dir?: TransitionDir };

export const TRANSITION_LABELS: Record<TransitionKind, string> = {
  none: "直接切換", fade: "淡入淡出", push: "推移", wipe: "翻頁掀開", zoom: "縮放",
  // 溶解類（名稱跟 Premiere 繁中版一樣，方便對照）
  dipBlack: "黑場過渡", dipWhite: "白場過渡", additive: "疊加溶解", nonAdditive: "非疊加溶解", filmDissolve: "膠片溶解",
};
export const TRANSITION_KINDS: TransitionKind[] = ["none", "fade", "dipBlack", "dipWhite", "additive", "nonAdditive", "filmDissolve", "push", "wipe", "zoom"];
export const TRANSITION_DIRS: TransitionDir[] = ["left", "right", "up", "down"];
/** 有方向可選的過場。 */
export const hasDir = (k: TransitionKind) => k === "push" || k === "wipe";

export function defaultTransition(kind: TransitionKind): PageTransition {
  return hasDir(kind) ? { kind, duration: 0.5, dir: "left" } : { kind, duration: 0.5 };
}

/** 讀存檔：不認得的丟掉（＝直接切換），秒數夾在 0.1–2。 */
export function readTransition(value: unknown): PageTransition | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (!TRANSITION_KINDS.includes(r.kind as TransitionKind)) return null;
  const kind = r.kind as TransitionKind;
  const d = typeof r.duration === "number" && Number.isFinite(r.duration) ? Math.min(2, Math.max(0.1, r.duration)) : 0.5;
  if (!hasDir(kind)) return { kind, duration: d };
  return { kind, duration: d, dir: TRANSITION_DIRS.includes(r.dir as TransitionDir) ? (r.dir as TransitionDir) : "left" };
}

export type SeqPage = { duration: number; transitionIn?: PageTransition | null };
export type SeqLayout = { starts: number[]; trans: number[]; total: number };

/**
 * 每一頁在整支影片的第幾秒出現、進場過場實際多長、整支多長。
 * 過場最長不超過前後兩頁各自長度的一半，不然一頁還沒播到就被換掉。
 */
export function sequenceLayout(pages: SeqPage[]): SeqLayout {
  const starts: number[] = [], trans: number[] = [];
  pages.forEach((p, i) => {
    const tr = i > 0 && p.transitionIn && p.transitionIn.kind !== "none"
      ? Math.min(p.transitionIn.duration, pages[i - 1].duration / 2, p.duration / 2) : 0;
    trans.push(tr);
    starts.push(i === 0 ? 0 : starts[i - 1] + pages[i - 1].duration - tr);
  });
  const last = pages.length - 1;
  return { starts, trans, total: last < 0 ? 0 : starts[last] + pages[last].duration };
}

export type SeqFrame = {
  /** 這一格的主頁（過場中＝要離開的那一頁），local＝那一頁自己的第幾秒。 */
  from: { page: number; local: number };
  /** 過場中才有：要進來的那一頁、過場跑到哪（0–1）、用哪種過場。 */
  to?: { page: number; local: number };
  mix?: number;
  transition?: PageTransition;
};

/** 整支影片的第 t 秒要畫什麼。超過結尾就停在最後一頁的最後一格。 */
export function sequenceAt(L: SeqLayout, pages: SeqPage[], t: number): SeqFrame {
  if (!pages.length) return { from: { page: 0, local: 0 } };
  const tt = Math.max(0, Math.min(t, L.total));
  let i = 0;
  for (let k = 0; k < pages.length; k++) if (L.starts[k] <= tt) i = k;
  if (i > 0 && L.trans[i] > 0 && tt < L.starts[i] + L.trans[i]) {
    return {
      from: { page: i - 1, local: tt - L.starts[i - 1] },
      to: { page: i, local: tt - L.starts[i] },
      mix: (tt - L.starts[i]) / L.trans[i],
      transition: pages[i].transitionIn!,
    };
  }
  return { from: { page: i, local: Math.min(pages[i].duration, tt - L.starts[i]) } };
}

export type Pose = {
  alpha: number; dx: number; dy: number; scale: number;
  /** 疊上去的混合方式（疊加溶解＝lighter、非疊加溶解＝lighten）；沒有＝一般。 */
  blend?: GlobalCompositeOperation;
  /** 只露出這一塊（畫面比例）；沒有＝整張。 */
  clip?: { x0: number; y0: number; x1: number; y1: number };
};
const REST_POSE: Pose = { alpha: 1, dx: 0, dy: 0, scale: 1 };
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/**
 * 過場跑到 mix（0–1）時，兩頁各自怎麼擺。toOnTop＝進來的那頁畫在上面。
 * 推移的 dir 是畫面移動的方向（left＝往左推，新的一頁從右邊進來）；
 * 掀開的 dir 是掀的方向（left＝從右邊往左掀開，新的一頁從右邊露出來）。
 */
export function transitionPoses(tr: PageTransition, mix: number): {
  from: Pose; to: Pose; toOnTop: boolean;
  /** 先把整格塗成這個顏色（疊加類要黑底，不然加亮會變一片白）；沒有＝白。 */
  base?: string;
  /** 最後蓋一層顏色（黑場／白場過渡）。 */
  overlay?: { color: string; alpha: number };
} {
  const raw = Math.max(0, Math.min(1, mix));
  const m = easeInOut(raw);
  const dir = tr.dir ?? "left";
  switch (tr.kind) {
    case "fade":
      return { from: REST_POSE, to: { ...REST_POSE, alpha: m }, toOnTop: true };
    case "dipBlack": case "dipWhite": {
      // 前半段舊的一頁淡到全黑（白），後半段從全黑（白）淡出新的一頁
      const color = tr.kind === "dipBlack" ? "#000" : "#fff";
      const first = raw < 0.5;
      return { from: first ? REST_POSE : { ...REST_POSE, alpha: 0 }, to: first ? { ...REST_POSE, alpha: 0 } : REST_POSE, toOnTop: true,
        overlay: { color, alpha: 1 - Math.abs(2 * raw - 1) } };
    }
    case "additive":
    case "nonAdditive":
      // 黑底上：新的一頁先用加亮（或取比較亮的）疊上來，後半段舊的一頁才退掉
      return { base: "#000", from: { ...REST_POSE, alpha: Math.min(1, 2 * (1 - raw)) },
        to: { ...REST_POSE, alpha: Math.min(1, 2 * raw), blend: tr.kind === "additive" ? "lighter" : "lighten" }, toOnTop: true };
    case "filmDissolve":
      // 接近底片的混合曲線：新的一頁比較早亮起來、過程比較柔
      return { from: REST_POSE, to: { ...REST_POSE, alpha: raw ** 0.55 }, toOnTop: true };
    case "push": {
      const [vx, vy] = dir === "left" ? [-1, 0] : dir === "right" ? [1, 0] : dir === "up" ? [0, -1] : [0, 1];
      return { from: { ...REST_POSE, dx: vx * m, dy: vy * m }, to: { ...REST_POSE, dx: -vx * (1 - m), dy: -vy * (1 - m) }, toOnTop: true };
    }
    case "wipe": {
      const clip = dir === "left" ? { x0: 1 - m, y0: 0, x1: 1, y1: 1 }
        : dir === "right" ? { x0: 0, y0: 0, x1: m, y1: 1 }
        : dir === "up" ? { x0: 0, y0: 1 - m, x1: 1, y1: 1 }
        : { x0: 0, y0: 0, x1: 1, y1: m };
      return { from: REST_POSE, to: { ...REST_POSE, clip }, toOnTop: true };
    }
    case "zoom":
      // 舊的一頁放大淡出，新的一頁在底下從微微放大收回原樣
      return { from: { ...REST_POSE, alpha: 1 - m, scale: 1 + 0.2 * m }, to: { ...REST_POSE, scale: 1.08 - 0.08 * m }, toOnTop: false };
    case "none":
      return { from: REST_POSE, to: { ...REST_POSE, alpha: m >= 0.5 ? 1 : 0 }, toOnTop: true };
  }
}
