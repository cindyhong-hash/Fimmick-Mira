import type { ImageSetCategory } from "./image-set-kit.ts";

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
