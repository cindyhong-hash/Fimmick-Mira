export type ImageSetKitStatus = "DRAFT" | "CONFIRMED" | "GENERATING" | "COMPLETE" | "PARTIAL" | "FAILED";
export type ImageSetCategory = "product" | "texture" | "background" | "benefit" | "decoration";
export type StoredAssetRole = "hero" | "detail" | "background" | "benefit" | "decoration";

/**
 * 賣點圖示的視覺路線。定義放在這一層而不是 image-set-roles，因為它必須
 * 跟著 planJson 一起存下來——規劃時選了哪一種，確認生成時就得用同一種。
 *
 * `plain`  無框線稿：中性單色，可跟著品牌色換色，套任何產品都能用（預設）
 * `framed` 線稿加圓框：DM 上常見的「功效四格」
 * `orb`    藍色光澤圓球：顏色寫死在圖裡，換品牌就不能用，給特定案子用
 */
export type BenefitIconStyle = "plain" | "framed" | "orb";
export const BENEFIT_ICON_STYLES: readonly BenefitIconStyle[] = ["plain", "framed", "orb"];
export const DEFAULT_BENEFIT_ICON_STYLE: BenefitIconStyle = "plain";

export function parseBenefitIconStyle(value: unknown): BenefitIconStyle | null {
  return BENEFIT_ICON_STYLES.includes(value as BenefitIconStyle) ? (value as BenefitIconStyle) : null;
}

export type ImageSetPlanItem = {
  id: string;
  category: ImageSetCategory;
  assetRole: StoredAssetRole;
  assetSubtype: string;
  purpose: string;
  core: boolean;
  defaultSelected: boolean;
  /** 只有賣點圖示會帶；確認階段靠它還原規劃時選的風格。 */
  benefitIconStyle?: BenefitIconStyle;
};

export const IMAGE_SET_MAX_ASSETS = 20;

export type ImageSetKitAssetRecord = {
  id: string;
  productId: string | null;
  batchId: string | null;
  assetRole: string | null;
  assetSubtype: string | null;
  status: string;
  imageUrl: string;
  subject?: string | null;
  prompt?: string;
  errorMessage: string | null;
  hasTransparentBackground: boolean | null;
  createdAt?: Date | string;
};

export function normalizeImageSetKitAssets(
  productId: string,
  batchId: string,
  assets: ImageSetKitAssetRecord[],
) {
  return assets
    .filter((asset) => asset.productId === productId && asset.batchId === batchId)
    .map((asset) => ({ ...asset, category: asset.assetRole ? toImageSetCategory(asset.assetRole) : null }));
}

export function deriveImageSetKitStatus(
  statuses: Array<"PENDING" | "GENERATING" | "DONE" | "FAILED">,
): Exclude<ImageSetKitStatus, "DRAFT" | "CONFIRMED"> {
  if (statuses.some((status) => status === "PENDING" || status === "GENERATING")) return "GENERATING";
  const done = statuses.filter((status) => status === "DONE").length;
  if (done === statuses.length && statuses.length > 0) return "COMPLETE";
  if (done > 0) return "PARTIAL";
  return "FAILED";
}

const IMAGE_SET_CATEGORIES = new Set<ImageSetCategory>([
  "product",
  "texture",
  "background",
  "benefit",
  "decoration",
]);

const STORED_ASSET_ROLES = new Set<StoredAssetRole>([
  "hero",
  "detail",
  "background",
  "benefit",
  "decoration",
]);

export function toStoredAssetRole(category: ImageSetCategory): StoredAssetRole {
  if (category === "product") return "hero";
  if (category === "texture") return "detail";
  return category;
}

export function toImageSetCategory(role: string): ImageSetCategory | null {
  if (role === "hero" || role === "product") return "product";
  if (role === "detail" || role === "texture") return "texture";
  if (role === "background" || role === "benefit" || role === "decoration") return role;
  return null;
}

function requiredString(value: unknown, field: string, index: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`套圖計畫第 ${index + 1} 項的 ${field} 不可為空`);
  }
  return value.trim();
}

export function parseImageSetPlanJson(value: string): ImageSetPlanItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("套圖計畫不是有效的 JSON");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("套圖計畫至少需要一項素材");
  if (parsed.length > IMAGE_SET_MAX_ASSETS) {
    throw new Error(`套圖計畫最多只能有 ${IMAGE_SET_MAX_ASSETS} 項素材`);
  }

  const seenIds = new Set<string>();
  return parsed.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`套圖計畫第 ${index + 1} 項格式不正確`);
    }
    const candidate = raw as Record<string, unknown>;
    const id = requiredString(candidate.id, "id", index);
    if (seenIds.has(id)) throw new Error(`套圖計畫含有重複 id：${id}`);
    seenIds.add(id);

    if (!IMAGE_SET_CATEGORIES.has(candidate.category as ImageSetCategory)) {
      throw new Error(`套圖計畫第 ${index + 1} 項的 category 不支援`);
    }
    if (!STORED_ASSET_ROLES.has(candidate.assetRole as StoredAssetRole)) {
      throw new Error(`套圖計畫第 ${index + 1} 項的 assetRole 不支援`);
    }
    const category = candidate.category as ImageSetCategory;
    const assetRole = candidate.assetRole as StoredAssetRole;
    if (assetRole !== toStoredAssetRole(category)) {
      throw new Error(`套圖計畫第 ${index + 1} 項的 assetRole 與 category 不一致`);
    }
    if (typeof candidate.core !== "boolean" || typeof candidate.defaultSelected !== "boolean") {
      throw new Error(`套圖計畫第 ${index + 1} 項的選取設定不正確`);
    }

    // 舊批次的 planJson 沒有這個欄位，所以缺少時不算錯；但寫了不認得的值就是錯，
    // 不能默默退回預設風格——那會讓確認階段生出跟規劃時不同的圖。
    let benefitIconStyle: BenefitIconStyle | undefined;
    if (candidate.benefitIconStyle !== undefined) {
      const style = parseBenefitIconStyle(candidate.benefitIconStyle);
      if (!style) throw new Error(`套圖計畫第 ${index + 1} 項的賣點圖示風格不支援`);
      benefitIconStyle = style;
    }

    return {
      id,
      category,
      assetRole,
      assetSubtype: requiredString(candidate.assetSubtype, "assetSubtype", index),
      purpose: requiredString(candidate.purpose, "purpose", index),
      core: candidate.core,
      defaultSelected: candidate.defaultSelected,
      ...(benefitIconStyle ? { benefitIconStyle } : {}),
    };
  });
}
