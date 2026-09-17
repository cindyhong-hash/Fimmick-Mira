export type ImageSetKitStatus = "DRAFT" | "CONFIRMED" | "GENERATING" | "COMPLETE" | "PARTIAL" | "FAILED";
export type ImageSetCategory = "product" | "texture" | "background" | "benefit" | "decoration";
export type StoredAssetRole = "hero" | "detail" | "background" | "benefit" | "decoration";

export type ImageSetPlanItem = {
  id: string;
  category: ImageSetCategory;
  assetRole: StoredAssetRole;
  assetSubtype: string;
  purpose: string;
  core: boolean;
  defaultSelected: boolean;
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

    return {
      id,
      category,
      assetRole,
      assetSubtype: requiredString(candidate.assetSubtype, "assetSubtype", index),
      purpose: requiredString(candidate.purpose, "purpose", index),
      core: candidate.core,
      defaultSelected: candidate.defaultSelected,
    };
  });
}
