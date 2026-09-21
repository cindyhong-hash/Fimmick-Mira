/**
 * 主題的視覺詞彙。
 *
 * 問題：ImageSetTheme 只有 `{ key, label, kind }`——一個標籤字串。
 * 選了「開學季」，模型拿到的就只有「開學季」三個字，
 * 沒有人告訴它開學季看起來是什麼，所以生出來的圖沒有主題感。
 *
 * 這裡補上「長什麼樣子」：時節光線、色調、道具、場景。
 *
 * ⚠️ 「乾淨可合成」與「有主題感」本質上互相衝突——背景板要求檯面淨空，
 * 但主題道具想擺上去。解法是分工：
 *   - 背景板只吃 `setting` 與 `season`（場景與光線可以有主題感，檯面仍淨空）
 *   - 裝飾元素吃 `palette` 與 `motifs`
 *   - 賣點視覺吃全部
 * 這樣主題表現在「場景與色調」，不是在檯面上堆道具。
 */
export type ImageSetThemeVisual = {
  /** 時節與光線線索 */
  season: string;
  /** 主題色調。作為環境色與點綴，不覆蓋商品本身的顏色。 */
  palette: string[];
  /** 可入鏡的道具與材質 */
  props: string[];
  /** 場景 */
  setting: string;
};

/** 購物節／促銷檔期共用一套：它們的視覺語言差異不大，都是「上架感、乾淨、有節奏」。 */
const SHOPPING_FESTIVAL: ImageSetThemeVisual = {
  season: "室內棚拍光線，明亮俐落，對比稍強",
  palette: ["正紅", "金", "純白"],
  props: ["幾何色塊", "俐落線條", "光潔檯面"],
  setting: "乾淨的棚拍檯面，帶有上架與陳列的節奏感",
};

const EXPLICIT: Record<string, ImageSetThemeVisual> = {
  開學季: {
    season: "初秋清晨，日光偏暖但清爽",
    palette: ["卡其", "墨綠", "奶油白"],
    props: ["筆記本", "文具", "帆布材質", "木質桌面"],
    setting: "整理過的書桌旁，或出門前的明亮洗手台",
  },
  開學前準備: {
    season: "夏末初秋，日光明亮",
    palette: ["卡其", "淺藍", "奶油白"],
    props: ["帆布包", "文具", "折疊整齊的衣物"],
    setting: "準備出門的桌面與洗手台",
  },
  開工開學收心: {
    season: "初春，光線清冷俐落",
    palette: ["霧灰", "淺藍", "白"],
    props: ["筆記本", "馬克杯", "整理過的檯面"],
    setting: "收拾整齊的工作桌或洗手台",
  },
  中秋節: {
    season: "秋夜月光，暖黃補光",
    palette: ["月白", "暖金", "墨藍"],
    props: ["圓形光暈", "桂花", "竹編或木質托盤"],
    setting: "夜色下的窗邊或檯面，帶月光感",
  },
  耶誕節: {
    season: "冬夜，暖色串燈點光",
    palette: ["深綠", "酒紅", "香檳金"],
    props: ["松枝", "緞面織物", "小燈串"],
    setting: "室內暖光角落或壁爐邊檯面",
  },
  耶誕檔: {
    season: "冬夜，暖色串燈點光",
    palette: ["深綠", "酒紅", "香檳金"],
    props: ["松枝", "緞面織物", "小燈串"],
    setting: "室內暖光角落或壁爐邊檯面",
  },
  農曆新年: {
    season: "冬末，光線明亮飽和",
    palette: ["正紅", "金", "朱砂"],
    props: ["紅色織物", "金屬器皿", "花器"],
    setting: "整潔的家中廳堂或梳妝檯",
  },
  農曆春節前採買: {
    season: "冬末，光線明亮",
    palette: ["正紅", "金", "米白"],
    props: ["紅色包裝紙", "提袋", "禮盒"],
    setting: "採買後的桌面陳列",
  },
  新年新氣象: {
    season: "初冬晴日，光線乾淨",
    palette: ["純白", "淺金", "天藍"],
    props: ["留白平面", "簡潔器皿"],
    setting: "整理過的明亮室內",
  },
  母親節: {
    season: "初夏柔光",
    palette: ["粉", "香檳", "奶白"],
    props: ["花束", "緞帶", "柔軟織物"],
    setting: "明亮溫柔的室內角落",
  },
  父親節: {
    season: "夏日，光線清晰有層次",
    palette: ["深藍", "灰", "木色"],
    props: ["皮革", "木質", "金屬"],
    setting: "沉穩的桌面或洗手台",
  },
  情人節: {
    season: "冬末柔光",
    palette: ["玫瑰粉", "酒紅", "米白"],
    props: ["花瓣", "緞帶", "柔焦光斑"],
    setting: "親密感的室內角落",
  },
  // 520 是告白檔期，視覺語言跟情人節同一類。它既不在原本的明確清單裡，
  // 也不符合購物節那條關鍵字規則（「告白日」比對不到），所以之前完全拿不到
  // 主題詞彙——選了 520 生出來的圖跟常態素材沒兩樣。
  // 「雙十連假檔」會被購物節規則接住，但「雙十連假」不會——差一個字。
  雙十連假: {
    season: "初秋明亮日光",
    palette: ["正紅", "純白", "暖金"],
    props: ["俐落線條", "光潔檯面", "簡約幾何"],
    setting: "明亮的室內檯面，帶有連假出遊前的輕鬆感",
  },
  "520 告白日": {
    season: "初夏午後柔光",
    palette: ["櫻粉", "玫瑰粉", "奶油白"],
    props: ["花瓣", "緞帶", "柔焦光斑"],
    setting: "明亮溫柔的室內角落",
  },
  七夕情人節: {
    season: "夏夜柔光",
    palette: ["玫瑰粉", "暖金", "夜藍"],
    props: ["花瓣", "薄紗", "點狀光暈"],
    setting: "夏夜窗邊",
  },
  白色情人節: {
    season: "初春柔光",
    palette: ["純白", "淺粉", "銀"],
    props: ["白色花卉", "薄紗"],
    setting: "明亮潔白的室內",
  },
  萬聖節: {
    season: "秋夜，側光帶戲劇性",
    palette: ["南瓜橘", "墨黑", "紫"],
    props: ["南瓜", "乾燥枝葉", "深色織物"],
    setting: "昏黃燈光下的桌面",
  },
  畢業季: {
    season: "初夏晴日，光線明亮",
    palette: ["寶藍", "金", "白"],
    props: ["緞帶", "花束", "書本"],
    setting: "明亮的室內或窗邊",
  },
  婦女節: {
    season: "初春柔光",
    palette: ["玫瑰金", "粉", "米白"],
    props: ["花卉", "柔軟織物"],
    setting: "溫柔明亮的梳妝檯",
  },
  "38 女王節": {
    season: "初春，光線明亮有自信",
    palette: ["玫瑰金", "正紅", "白"],
    props: ["花卉", "金屬質感", "緞面"],
    setting: "明亮俐落的梳妝檯",
  },
  兒童節: {
    season: "春日晴朗",
    palette: ["明黃", "天藍", "草綠"],
    props: ["圓潤幾何", "明亮色塊"],
    setting: "明亮輕快的室內",
  },
  端午連假: {
    season: "初夏，光線清亮",
    palette: ["竹綠", "艾草綠", "米白"],
    props: ["竹葉", "編織材質", "水感"],
    setting: "通風明亮的室內",
  },
  清明連假: {
    season: "春雨後，光線柔和偏涼",
    palette: ["霧綠", "灰藍", "米白"],
    props: ["嫩葉", "水珠"],
    setting: "雨後明亮的窗邊",
  },
  春季賞花踏青: {
    season: "春日暖陽",
    palette: ["櫻粉", "嫩綠", "米白"],
    props: ["花卉", "嫩葉"],
    setting: "灑進日光的窗邊",
  },
  初春換季: {
    season: "初春，光線轉暖",
    palette: ["嫩綠", "淺粉", "白"],
    props: ["新芽", "輕薄織物"],
    setting: "通風明亮的室內",
  },
  初夏防曬季開始: {
    season: "初夏強光，陰影清楚",
    palette: ["天藍", "白", "檸檬黃"],
    props: ["水花", "清透材質"],
    setting: "光線充足的洗手台或戶外陰影處",
  },
  夏季消暑: {
    season: "盛夏強光",
    palette: ["冰藍", "白", "薄荷綠"],
    props: ["冰塊", "水珠", "玻璃"],
    setting: "清涼通風的室內",
  },
  "盛夏戶外／泳裝季": {
    season: "盛夏日光，對比強",
    palette: ["海藍", "沙色", "白"],
    props: ["水面", "沙粒", "藤編"],
    setting: "泳池畔或海邊陰影處",
  },
  暑假出遊: {
    season: "夏日晴朗",
    palette: ["天藍", "沙色", "白"],
    props: ["藤編", "草帽", "行李織物"],
    setting: "度假感的明亮室內",
  },
  夏日除毛需求高峰: {
    season: "盛夏強光，皮膚質感清楚",
    palette: ["冰藍", "白", "銀"],
    props: ["水珠", "清透材質", "光潔表面"],
    setting: "明亮清爽的洗手台",
  },
  梅雨潮濕護理: {
    season: "梅雨季，光線柔而偏灰",
    palette: ["霧藍", "灰", "白"],
    props: ["水氣", "霧面材質"],
    setting: "潮濕天氣的室內窗邊",
  },
  入秋換季保養: {
    season: "初秋，日光轉暖且低角度",
    palette: ["暖棕", "奶油白", "淺金"],
    props: ["羊毛織物", "木質", "乾燥枝葉"],
    setting: "灑進斜陽的室內檯面",
  },
  秋季乾燥肌護理: {
    season: "深秋，光線乾淨偏暖",
    palette: ["暖棕", "米白", "赭色"],
    props: ["乾燥花材", "羊毛", "木質"],
    setting: "溫暖乾爽的室內",
  },
  換季保暖: {
    season: "初冬，光線低而柔",
    palette: ["駝色", "暖灰", "奶白"],
    props: ["針織", "羊毛", "溫熱飲品"],
    setting: "室內暖光角落",
  },
  冬季乾燥護理: {
    season: "冬日室內暖光",
    palette: ["奶白", "淺駝", "霧灰"],
    props: ["厚織物", "霧面陶器"],
    setting: "乾燥季節的室內檯面",
  },
  "年末回顧／跨年": {
    season: "冬夜，點狀光源",
    palette: ["深藍", "銀", "香檳金"],
    props: ["金屬光澤", "細緻光點"],
    setting: "夜色下的室內",
  },
  元旦跨年檔: {
    season: "冬夜轉晨，光線由暗到亮",
    palette: ["深藍", "金", "白"],
    props: ["金屬光澤", "光點"],
    setting: "跨年夜的室內窗邊",
  },
  "尾牙／年終": {
    season: "冬夜暖光",
    palette: ["酒紅", "金", "深木色"],
    props: ["緞面", "金屬器皿"],
    setting: "聚會感的室內",
  },
};

/** 檔期關鍵字 → 購物節共用詞彙。 */
const FESTIVAL_HINT = /購物節|年中慶|女王節|黑五|感恩節|連假檔|節檔|檔$/;

/**
 * 取得主題的視覺詞彙。比對不到就回 null——沿用原本只有標籤的行為，
 * 不會因為新增主題而壞掉。
 */
export function imageSetThemeVisual(label: string | null | undefined): ImageSetThemeVisual | null {
  const key = label?.trim();
  if (!key) return null;
  return EXPLICIT[key] ?? (FESTIVAL_HINT.test(key) ? SHOPPING_FESTIVAL : null);
}

/**
 * 主題色名 → 色碼。
 *
 * 主題詞彙裡的顏色是給提示詞看的中文（「玫瑰粉」），但圓底徽章的圓是由程式畫的，
 * 需要實際色碼。沒有對應到的色名會被略過，呼叫端再退回品牌色——多一個沒收錄的
 * 色名只會讓那個主題沿用品牌色，不會壞掉。
 */
const THEME_COLOURS: Record<string, { hex: string; en: string }> = {
  玫瑰粉: { hex: "#D98BA0", en: "rose pink" },
  櫻粉: { hex: "#E8A3B8", en: "cherry blossom pink" },
  淺粉: { hex: "#EFB8C8", en: "pale pink" },
  粉: { hex: "#E79BB0", en: "soft pink" },
  酒紅: { hex: "#8C2F39", en: "wine red" },
  正紅: { hex: "#C8332F", en: "true red" },
  朱砂: { hex: "#C4453A", en: "vermilion" },
  南瓜橘: { hex: "#D2762E", en: "pumpkin orange" },
  赭色: { hex: "#A9603C", en: "ochre" },
  暖棕: { hex: "#8B5E3C", en: "warm brown" },
  駝色: { hex: "#B08A63", en: "camel" },
  淺駝: { hex: "#C3A184", en: "light camel" },
  木色: { hex: "#A9805B", en: "natural wood" },
  深木色: { hex: "#6F4E37", en: "dark walnut" },
  沙色: { hex: "#C2A883", en: "sand" },
  卡其: { hex: "#A79B72", en: "khaki" },
  明黃: { hex: "#E8C23A", en: "bright yellow" },
  檸檬黃: { hex: "#E4D35B", en: "lemon yellow" },
  暖金: { hex: "#C9A227", en: "warm gold" },
  淺金: { hex: "#D9BE72", en: "pale gold" },
  金: { hex: "#C2A14D", en: "gold" },
  玫瑰金: { hex: "#C9887C", en: "rose gold" },
  香檳: { hex: "#D6C3A5", en: "champagne" },
  香檳金: { hex: "#C9B18A", en: "champagne gold" },
  嫩綠: { hex: "#8FBF6A", en: "fresh green" },
  草綠: { hex: "#7FA95A", en: "grass green" },
  竹綠: { hex: "#6F9E68", en: "bamboo green" },
  薄荷綠: { hex: "#8FC9AE", en: "mint green" },
  艾草綠: { hex: "#8A9A6B", en: "sage green" },
  深綠: { hex: "#3F6B4A", en: "deep green" },
  墨綠: { hex: "#2F4F43", en: "forest green" },
  霧綠: { hex: "#9BB3A4", en: "muted sage" },
  冰藍: { hex: "#A8CBE0", en: "ice blue" },
  天藍: { hex: "#7FB3D9", en: "sky blue" },
  淺藍: { hex: "#A9C9E3", en: "pale blue" },
  海藍: { hex: "#3E7CA6", en: "ocean blue" },
  寶藍: { hex: "#2C5FA8", en: "royal blue" },
  深藍: { hex: "#2A4A73", en: "deep blue" },
  墨藍: { hex: "#22374F", en: "midnight blue" },
  夜藍: { hex: "#33415C", en: "night blue" },
  灰藍: { hex: "#8195A8", en: "slate blue" },
  霧藍: { hex: "#A3B6C4", en: "misty blue" },
  紫: { hex: "#8A6BB1", en: "purple" },
  白: { hex: "#F7F7F5", en: "white" },
  純白: { hex: "#FFFFFF", en: "pure white" },
  米白: { hex: "#F0E9DD", en: "off white" },
  月白: { hex: "#F2F1EA", en: "moon white" },
  奶白: { hex: "#F4EDE3", en: "milk white" },
  奶油白: { hex: "#F5E9D7", en: "cream white" },
  灰: { hex: "#9AA0A6", en: "grey" },
  暖灰: { hex: "#A79E95", en: "warm grey" },
  霧灰: { hex: "#B4B7B5", en: "misty grey" },
  銀: { hex: "#B9BDC2", en: "silver" },
  墨黑: { hex: "#2B2B2B", en: "ink black" },
};

/** @returns 這個主題的代表色碼；主題沒有可對應的色名時回 null。 */
export function imageSetThemeHex(label: string | null | undefined): string | null {
  const visual = imageSetThemeVisual(label);
  if (!visual) return null;
  for (const word of visual.palette) {
    const entry = THEME_COLOURS[word];
    if (entry) return entry.hex;
  }
  return null;
}

/**
 * @returns 這個主題色系的英文說法，最多兩個色，例如 "cherry blossom pink and rose pink"。
 *
 * ⚠️ 生圖提示詞的英文段落只能用這個，不能塞中文色名，也不能塞色碼——兩者都會被
 * 模型當成畫面文字畫出來（這個專案踩過「雙重保濕」與色碼兩次）。
 */
export function imageSetThemePaletteEn(label: string | null | undefined): string | null {
  const visual = imageSetThemeVisual(label);
  if (!visual) return null;
  const names = visual.palette.map((word) => THEME_COLOURS[word]?.en).filter(Boolean).slice(0, 2);
  return names.length ? names.join(" and ") : null;
}
