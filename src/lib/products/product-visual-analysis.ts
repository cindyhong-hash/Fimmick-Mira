import sharp from "sharp";
import { loadBuffer } from "../storage.ts";
import {
  fallbackProductVisualProfile,
  parseProductVisualProfile,
  type ProductVisualProfile,
  type ProductVisualProfileInput,
} from "./product-visual-profile.ts";
import { imageSetThemeVisual } from "./image-set-theme-visuals.ts";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL ?? "google/gemini-2.5-flash";
const MAX_REFERENCE_IMAGES = 5;
const MAX_IMAGE_EDGE = 1600;

export type ProductBrandFacts = {
  primaryColor?: string | null;
  toneLabels?: string[] | null;
};

export type ImageSetArtDirection = {
  concept: string;
  palette: { dominant: string[]; accent: string[] };
  lighting: string;
  materials: string[];
  backgroundLanguage: string;
  cameraLanguage: string;
  consistencyRules: string[];
  mood: string[];
  decorationStyle: string[];
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * 只跟「商品本身」有關的一致性規則。
 *
 * 沒有商品入鏡的素材（背景、裝飾、賣點視覺、賣點圖示）不能收到這幾條：
 * 對生圖模型來說，句子裡出現的名詞就是要畫的東西，而第一條字面上就是
 * 「這張是同一個商品的另一個角度」。實測 520 背景因此長出一支不存在的
 * 按壓瓶，即使 MUST NOT SHOW 已經寫了「任何商品／瓶罐」。
 * 過濾在 image-set-prompts 做，靠字串相等比對，舊批次存下來的規則也對得上。
 */
export const PRODUCT_IDENTITY_RULES = [
  "所有畫面視為同一產品的不同視角。",
  "維持產品的外型、比例、顏色、結構與可見 Logo／文字。",
];

export function parseImageSetArtDirection(raw: unknown): ImageSetArtDirection | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const palette = value.palette;
  if (!palette || typeof palette !== "object" || Array.isArray(palette)) return null;
  const colors = palette as Record<string, unknown>;
  if (
    typeof value.concept !== "string"
    || !isStringArray(colors.dominant)
    || !isStringArray(colors.accent)
    || typeof value.lighting !== "string"
    || !isStringArray(value.materials)
    || typeof value.backgroundLanguage !== "string"
    || typeof value.cameraLanguage !== "string"
    || !isStringArray(value.consistencyRules)
    || (value.mood !== undefined && !isStringArray(value.mood))
    || (value.decorationStyle !== undefined && !isStringArray(value.decorationStyle))
  ) return null;

  return {
    concept: value.concept,
    palette: { dominant: colors.dominant, accent: colors.accent },
    lighting: value.lighting,
    materials: value.materials,
    backgroundLanguage: value.backgroundLanguage,
    cameraLanguage: value.cameraLanguage,
    consistencyRules: value.consistencyRules,
    mood: value.mood ?? [],
    decorationStyle: value.decorationStyle ?? [],
  };
}

export type VisionRequest = {
  imageDataUrls: string[];
  systemPrompt: string;
  product: ProductVisualProfileInput;
  signal?: AbortSignal;
};

export type ProductVisualAnalysisDependencies = {
  loadAsDataUrl?: (url: string, signal?: AbortSignal) => Promise<string>;
  completeVision?: (request: VisionRequest) => Promise<string>;
};

const SYSTEM_PROMPT = `Only report visible image facts and supplied product text. Do not infer efficacy, certification, ingredients, safety, target demographics, or usage that is not shown or stated. Treat every image as another view of the same product. Return JSON only.

Return exactly this ProductVisualProfile JSON contract:
{
  "version": 1,
  "productType": "string",
  "productArchetype": "beauty_device | skincare | cosmetics | food_beverage | fashion | electronics | home | other",
  "confidence": 0,
  "appearance": {
    "shape": "string",
    "materials": ["string"],
    "colors": ["string"],
    "distinctiveDetails": ["string"],
    "visibleTextOrLogos": ["string"]
  },
  "useCases": ["string"],
  "suitableScenes": ["string"],
  "visualMotifs": ["string"],
  "prohibitedChanges": ["string"],
  "sourceImageCount": 0
}`;

function uniqueReferenceUrls(input: ProductVisualProfileInput): string[] {
  const rawUrls = [...new Set((input.rawImageUrls ?? []).map((url) => url.trim()).filter(Boolean))];
  const heroUrl = input.heroImageUrl?.trim() ?? "";
  if (!heroUrl) return rawUrls.slice(0, MAX_REFERENCE_IMAGES);

  return [...rawUrls.filter((url) => url !== heroUrl).slice(0, MAX_REFERENCE_IMAGES - 1), heroUrl];
}

export function countProductVisualReferenceImages(input: ProductVisualProfileInput): number {
  return uniqueReferenceUrls(input).length;
}

async function defaultLoadAsDataUrl(url: string, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  if (url.startsWith("data:")) {
    const [, encoded = ""] = url.split(",", 2);
    const buffer = Buffer.from(encoded, url.includes(";base64,") ? "base64" : "utf8");
    const png = await sharp(buffer)
      .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    signal?.throwIfAborted();
    return `data:image/png;base64,${png.toString("base64")}`;
  }

  const buffer = await loadBuffer(url, signal);
  const png = await sharp(buffer)
    .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  signal?.throwIfAborted();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function defaultCompleteVision(request: VisionRequest): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://marketing-tool.local",
      "X-Title": "Marketing Tool",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: request.systemPrompt },
        {
          role: "user",
          content: [
            ...request.imageDataUrls.map((url) => ({ type: "image_url", image_url: { url } })),
            {
              type: "text",
              text: JSON.stringify({
                name: request.product.name ?? "",
                description: request.product.description ?? "",
                category: request.product.category ?? "",
              }),
            },
          ],
        },
      ],
      max_tokens: 1000,
    }),
    signal: request.signal,
  });
  const data = await response.json() as {
    choices?: { message?: { content?: string | null } }[];
    error?: { message?: string };
  };
  if (!response.ok || data.error) throw new Error(data.error?.message ?? `OpenRouter error ${response.status}`);

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenRouter returned empty vision output");
  return text;
}

export function parseVisionJson(text: string): ProductVisualProfile | null {
  const json = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return parseProductVisualProfile(JSON.parse(json));
  } catch {
    return null;
  }
}

export async function analyzeProductVisualProfile(
  input: ProductVisualProfileInput,
  deps: ProductVisualAnalysisDependencies = {},
  signal?: AbortSignal,
): Promise<ProductVisualProfile> {
  signal?.throwIfAborted();
  const urls = uniqueReferenceUrls(input);
  if (urls.length === 0) return fallbackProductVisualProfile(input);

  try {
    const loadAsDataUrl = deps.loadAsDataUrl ?? defaultLoadAsDataUrl;
    const completeVision = deps.completeVision ?? defaultCompleteVision;
    const imageDataUrls = await Promise.all(urls.map((url) => loadAsDataUrl(url, signal)));
    signal?.throwIfAborted();
    const profile = parseVisionJson(await completeVision({ imageDataUrls, systemPrompt: SYSTEM_PROMPT, product: input, signal }));
    signal?.throwIfAborted();
    return profile ? { ...profile, sourceImageCount: imageDataUrls.length } : fallbackProductVisualProfile(input);
  } catch {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    return fallbackProductVisualProfile(input);
  }
}

export function buildImageSetArtDirection(
  profile: ProductVisualProfile,
  brand: ProductBrandFacts,
  theme?: { label: string; kind: "PROMO" | "SEASONAL" } | null,
): ImageSetArtDirection {
  const dominant = profile.appearance.colors;
  const accent = brand.primaryColor?.trim() ? [brand.primaryColor.trim()] : [];
  const productDescription = profile.productType.trim();
  // 主題原本只有標籤字串進到提示詞（「開學季」三個字），模型不知道它長什麼樣子。
  // 這裡把時節、色調、道具、場景一併帶進來；比對不到主題就維持原本行為。
  const visual = theme ? imageSetThemeVisual(theme.label) : null;
  const scene = profile.suitableScenes[0] ?? "乾淨且保留呼吸感的背景";

  return {
    concept: `${productDescription ? `${productDescription} 的` : ""}${theme ? `${theme.label}主題` : ""}可合成廣告素材包`,
    palette: { dominant, accent },
    lighting: visual ? `${visual.season}；柔和、乾淨且跨素材一致的高級廣告光線` : "柔和、乾淨且跨素材一致的高級廣告光線",
    materials: profile.appearance.materials,
    // 背景語言吃場景、時節與色調，但**不吃道具**——背景板要求檯面淨空，
    // 主題感要表現在「場景、光線與顏色」，不是在檯面上堆東西。
    //
    // 色調原本也被排除，結果選 520 告白日生出來的背景還是商品的淡藍色，
    // 整組素材看不出跟主題有關。色調不是道具：它只影響牆面與光線的顏色，
    // 檯面一樣淨空，所以不該跟道具一起被擋掉。
    backgroundLanguage: visual
      ? `${visual.setting}（${visual.season}）；環境色調以 ${visual.palette.join("、")} 為主，牆面與光線都要看得出這個色調，但檯面仍然完全淨空`
      : scene,
    cameraLanguage: "清晰、高級且便於後續廣告合成的視覺語言",
    consistencyRules: [
      ...PRODUCT_IDENTITY_RULES,
      ...profile.prohibitedChanges,
      ...(brand.toneLabels?.filter(Boolean).map((tone) => `品牌調性：${tone}`) ?? []),
      ...(theme ? [`整批素材一致呼應「${theme.label}」，但不可自行生成主題文字、日期或促銷字樣。`] : []),
      ...(visual ? [`「${theme?.label}」的視覺語彙：${visual.season}；色調 ${visual.palette.join("、")}；可用元素 ${visual.props.join("、")}。主題只表現在場景、光線、色調與裝飾元素，不改變商品本身的顏色與材質。`] : []),
    ],
    mood: [...new Set([
      ...(brand.toneLabels?.map((tone) => tone.trim()).filter(Boolean) ?? []),
      ...(theme ? [theme.label] : []),
      ...(visual ? [visual.season] : []),
    ])],
    decorationStyle: [...new Set([
      ...profile.visualMotifs.map((motif) => motif.trim()).filter(Boolean),
      ...(theme ? [`呼應${theme.label}的非文字裝飾語彙`] : []),
      ...(visual ? [...visual.props, `色調 ${visual.palette.join("、")}`] : []),
    ])],
  };
}
