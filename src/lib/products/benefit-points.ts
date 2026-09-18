/**
 * 從商品資料整理出「賣點圖示」要用的 3–5 個功效點。
 *
 * 刻意用規則拆解而不是再打一次 AI：
 * - 使用者已經在商品頁把賣點寫成一句一句了，切開就是現成的標題
 * - 每組套圖多一次 LLM 呼叫，成本與失敗點都會增加
 * - 純函式可以測，結果穩定——規劃階段與確認階段必須算出同一組項目，
 *   否則確認時的清單比對會失敗
 *
 * 文字不進圖：icon 由 AI 生成（無文字、透明底），標題留在資料裡，
 * 排版時用真正的字型渲染。圖像模型畫中文很容易缺筆畫或糊掉，
 * 這個專案已經踩過（背景素材出現過亂碼英文）。
 */
export type BenefitPoint = {
  /** 4–8 字短標題，例如「溫和去角質」 */
  title: string;
  /** 8–16 字補充說明，可空 */
  note: string;
};

const MIN_POINTS = 3;
const MAX_POINTS = 5;
const TITLE_MAX = 8;
const NOTE_MAX = 16;

/** 「賣點：」「定位：」這類欄位標籤要剝掉，不然會被當成標題的一部分。 */
const FIELD_LABEL = /^\s*(賣點|定位|特色|功效|訴求|Selling points?|Positioning|Benefits?)\s*[:：]\s*/i;

/** 句子切分：中英文標點都吃。 */
const SPLIT = /[、，,。；;\n\r]+/;

/** 去掉會讓標題變冗長的連接詞與語助詞。 */
function tidy(value: string): string {
  return value
    .replace(/^[讓使能可幫助有效]+/, "")
    .replace(/[的了呢吧啊！!？?\s]+$/, "")
    .trim();
}

type Candidate = BenefitPoint & { truncated: boolean };

function toPoint(sentence: string): Candidate | null {
  const text = tidy(sentence);
  if (!text) return null;
  if (text.length <= TITLE_MAX) return { title: text, note: "", truncated: false };
  // 太長的句子切出來常是沒有意義的片段（「專為除毛前打造的」），
  // 所以標記起來，只有在完整句不夠 3 個時才拿來補。
  return { title: text.slice(0, TITLE_MAX), note: text.slice(0, NOTE_MAX), truncated: true };
}

/**
 * @param description 商品頁填的賣點與定位（Product.description）
 * @param fallback    分析結果的 useCases，description 不足時補
 */
export function deriveBenefitPoints(
  description: string | null | undefined,
  fallback: string[] = [],
): BenefitPoint[] {
  const isBenefitLine = (line: string) => !/^\s*(定位|Positioning)\s*[:：]/i.test(line);

  const fromDescription = (description ?? "")
    .split(/\r?\n/)
    // 「定位」講的是市場定位不是功效，排在賣點之後
    .sort((a, b) => Number(isBenefitLine(b)) - Number(isBenefitLine(a)))
    .map((line) => line.replace(FIELD_LABEL, ""))
    .join("、")
    .split(SPLIT)
    .map(toPoint)
    .filter((point): point is Candidate => !!point);

  const fromFallback = fallback.map(toPoint).filter((point): point is Candidate => !!point);

  const merged: BenefitPoint[] = [];
  const seen = new Set<string>();
  const take = (pool: Candidate[], target: number) => {
    for (const point of pool) {
      if (merged.length >= target || seen.has(point.title)) continue;
      seen.add(point.title);
      merged.push({ title: point.title, note: point.note });
    }
  };

  // 優先順序：品牌自己寫的完整句 → 品牌寫的長句片段 → 分析出的 useCases。
  // 後兩者只在「不足 3 個」時才動用，不拿來湊滿 5 個——
  // 賣點已經夠時再補「除毛前保養」這種概括詞只會重複，沒有新資訊。
  take(fromDescription.filter(({ truncated }) => !truncated), MAX_POINTS);
  if (merged.length < MIN_POINTS) take(fromDescription.filter(({ truncated }) => truncated), MIN_POINTS);
  if (merged.length < MIN_POINTS) take(fromFallback, MIN_POINTS);

  // 不足 3 個就不做這組素材——兩個 icon 排不成一個賣點模組。
  return merged.length >= MIN_POINTS ? merged : [];
}
