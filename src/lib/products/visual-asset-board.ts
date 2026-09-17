import { deriveImageSetKitStatus, type ImageSetCategory, type ImageSetKitStatus } from "./image-set-kit.ts";

export type VisualAssetBoardAsset = { id: string; category: ImageSetCategory | null; status: string };

export function groupVisualAssetBoardAssets<T extends VisualAssetBoardAsset>(assets: T[]) {
  const groups: Partial<Record<ImageSetCategory, T[]>> = {};
  for (const asset of assets) {
    if (!asset.category) continue;
    (groups[asset.category] ??= []).push(asset);
  }
  return groups;
}

export function visualAssetBoardCounts(assets: VisualAssetBoardAsset[]) {
  return {
    total: assets.length,
    done: assets.filter(({ status }) => status === "DONE").length,
    failed: assets.filter(({ status }) => status === "FAILED").length,
    active: assets.filter(({ status }) => status === "PENDING" || status === "GENERATING").length,
  };
}

export function buildAssetKitSelection(input: { clientId: string; productId: string; batchId: string; assets: VisualAssetBoardAsset[] }) {
  return {
    clientId: input.clientId,
    productId: input.productId,
    batchId: input.batchId,
    assetIds: input.assets.filter(({ status }) => status === "DONE").map(({ id }) => id),
  };
}

export type VisualAssetKitHistorySource = {
  id: string;
  themeKey: string | null;
  themeLabel: string | null;
  status: string;
  createdAt: Date | string;
  confirmedAt: Date | string | null;
};

export type VisualAssetKitHistoryAsset = {
  batchId: string | null;
  status: string;
  imageUrl: string;
};

export type VisualAssetKitHistoryItem = {
  id: string;
  theme: { key: string; label: string | null } | null;
  status: ImageSetKitStatus | string;
  createdAt: Date | string;
  confirmedAt: Date | string | null;
  counts: ReturnType<typeof visualAssetBoardCounts>;
  previewUrls: string[];
};

export function buildVisualAssetKitHistory(
  kits: VisualAssetKitHistorySource[],
  assets: VisualAssetKitHistoryAsset[],
): VisualAssetKitHistoryItem[] {
  return kits.map((kit) => {
    const kitAssets = assets.filter(({ batchId }) => batchId === kit.id);
    const counts = visualAssetBoardCounts(kitAssets.map((asset, index) => ({
      id: `${kit.id}-${index}`,
      category: null,
      status: asset.status,
    })));
    const statuses = kitAssets
      .map(({ status }) => status)
      .filter((status): status is "PENDING" | "GENERATING" | "DONE" | "FAILED" =>
        status === "PENDING" || status === "GENERATING" || status === "DONE" || status === "FAILED");

    return {
      id: kit.id,
      theme: kit.themeKey ? { key: kit.themeKey, label: kit.themeLabel } : null,
      status: statuses.length === kitAssets.length && statuses.length > 0
        ? deriveImageSetKitStatus(statuses)
        : kit.status,
      createdAt: kit.createdAt,
      confirmedAt: kit.confirmedAt,
      counts,
      previewUrls: kitAssets
        .filter(({ status, imageUrl }) => status === "DONE" && Boolean(imageUrl))
        .map(({ imageUrl }) => imageUrl)
        .slice(0, 4),
    };
  });
}
