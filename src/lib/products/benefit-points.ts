/**
 * 從商品資料整理出「賣點圖示」要用的 3–5 個功效點。
 *
 * 刻意用規則拆解而不是再打一次 AI：
 * - 使用者已經在商品頁把賣點寫成一句一句了，切開就是現成的標題
 * - 每組套圖多一次 LLM 呼叫，成本與失敗點都會增加
 * - 純函式可以測，結果穩定——規劃階段與確認階段必須算出同一組項目，
 *   否則確認時的清單比對會失敗
 *
 * 文字不進圖：icon 由 AI 生成（無文字、純白底），標題留在資料裡，
 * 排版時用真正的字型渲染。圖像模型畫中文很容易缺筆畫或糊掉，
 * 這個專案已經踩過（背景素材出現過亂碼英文）。
 */
export type BenefitPoint = {
  /** 4–8 字短標題，例如「溫和去角質」 */
  title: string;
  /** 8–16 字補充說明，可空 */
  description: string;
  /**
   * 這個賣點要畫成什麼圖形，英文純 ASCII，例如 "two overlapping water droplets"。
   *
   * ⚠️ 生圖提示詞只能用這個欄位，不能放中文標題。實測把中文標題放進提示詞，
   * 模型會直接把那幾個字畫進圖裡（「雙重保濕」被畫了兩次），而且後面補多少
   * 「不可以有文字」都沒用——這個專案早就驗證過否定指令對文字生圖無效。
   * 沒有這個欄位就不做這張 icon，寧可少一張也不要生出有字的圖。
   */
  iconConcept: string;
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
  // 規則拆解只有中文，給不出英文視覺描述，所以 iconConcept 留空——
  // 呼叫端會因此不做賣點圖示，避免把中文送進提示詞。
  if (text.length <= TITLE_MAX) return { title: text, description: "", iconConcept: "", truncated: false };
  // 太長的句子切出來常是沒有意義的片段（「專為除毛前打造的」），
  // 所以標記起來，只有在完整句不夠 3 個時才拿來補。
  return { title: text.slice(0, TITLE_MAX), description: text.slice(0, NOTE_MAX), iconConcept: "", truncated: true };
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
      merged.push({ title: point.title, description: point.description, iconConcept: point.iconConcept });
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

/**
 * 規則拆解只能切句子，切不出「面向」。實測這支商品得到的四個賣點裡，
 * 「酵素角質護理」「帶走老廢角質」講的是同一件事，因為它們本來就是
 * 同一句話裡的兩個子句。要避免語意重複必須理解語意，所以這一段交給 LLM。
 *
 * 但 LLM 有可能失敗或回傳爛資料，而賣點決定了會生幾張付費圖片，
 * 所以結果一律驗過才用，驗不過就退回純規則版本。
 */
const MAX_TITLE_FOR_LLM = 8;
const MAX_DESCRIPTION_FOR_LLM = 16;

export function buildBenefitPointsPrompt(product: {
  name: string;
  category?: string | null;
  description?: string | null;
}): string {
  return [
    "你是資深行銷企劃。請從以下商品資料整理出 3 到 5 個核心賣點，之後會各做成一張資訊圖示。",
    "",
    `商品名稱：${product.name}`,
    product.category ? `分類：${product.category}` : "",
    `商品介紹與賣點：\n${product.description ?? ""}`,
    "",
    "規則：",
    "1. 每個賣點必須是不同面向。若兩個賣點在講同一件事（例如「酵素角質護理」與「帶走老廢角質」都在講去角質），只保留一個，換成其他面向（使用時機、膚觸結果、適用部位、搭配用途等）。",
    `2. title 為 ${MAX_TITLE_FOR_LLM} 個中文字以內的短標題，直接寫出賣點本身，不要標點。`,
    `3. description 為 ${MAX_DESCRIPTION_FOR_LLM} 個中文字以內的補充說明，不要重複 title 的字。`,
    "4. iconConcept 用英文描述這個賣點要畫成什麼圖形，只能有純英文字母與空格，不要出現中文、品牌名、產品名或任何要寫進畫面的字詞。描述具體的物件，例如 two overlapping water droplets、a feather touching smooth skin。",
    "5. 只能使用商品資料裡有的資訊，不要自行發明功效或成分。",
    "6. 只輸出 JSON 陣列，不要有其他文字或 markdown 標記。",
    "",
    '格式：[{"title":"溫和去角質","description":"酵素帶走老廢角質","iconConcept":"a soft brush sweeping over skin"}]',
  ].filter(Boolean).join("\n");
}

/** LLM 回來的東西一律當不可信：長度、數量、重複都要擋。 */
export function parseBenefitPointsJson(raw: string | null | undefined): BenefitPoint[] {
  if (!raw) return [];
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const points: BenefitPoint[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Record<string, unknown>;
    const fullTitle = typeof candidate.title === "string" ? tidy(candidate.title) : "";
    const title = fullTitle.slice(0, MAX_TITLE_FOR_LLM);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    // 說明文字只去頭尾空白：tidy() 會剝掉開頭的「幫助／讓／使」，
    // 那是為短標題設計的，套在說明上會把有意義的字吃掉。
    const fullDescription = typeof candidate.description === "string" ? candidate.description.trim() : "";
    // 只是複述標題的說明沒有資訊；要在截斷前比，否則長標題截短後就比不出來了。
    const description = fullDescription === fullTitle ? "" : fullDescription.slice(0, MAX_DESCRIPTION_FOR_LLM);
    // iconConcept 進得了生圖提示詞，所以只收純 ASCII：夾帶中文的話，
    // 模型就會把那幾個字畫進圖裡。可疑就整筆丟掉。
    const concept = typeof candidate.iconConcept === "string" ? candidate.iconConcept.trim() : "";
    if (!concept || !/^[\x20-\x7E]+$/.test(concept)) continue;
    points.push({ title, description, iconConcept: concept.slice(0, 120) });
    if (points.length >= MAX_POINTS) break;
  }
  return points.length >= MIN_POINTS ? points : [];
}

/**
 * 整理賣點：先問 LLM，拿不到可用結果就退回規則拆解。
 *
 * @param chat 打 LLM 的函式；注入而不是直接 import，測試才不用真的連網。
 */
export async function extractBenefitPoints(
  product: { name: string; category?: string | null; description?: string | null },
  fallbackUseCases: string[],
  chat: (prompt: string) => Promise<string | null>,
): Promise<BenefitPoint[]> {
  const ruleBased = deriveBenefitPoints(product.description, fallbackUseCases);
  // 連規則版都湊不到 3 個，代表商品資料太少，不值得為它打一次 LLM。
  if (!ruleBased.length) return [];
  try {
    const fromModel = parseBenefitPointsJson(await chat(buildBenefitPointsPrompt(product)));
    return fromModel.length ? fromModel : ruleBased;
  } catch {
    return ruleBased;
  }
}
