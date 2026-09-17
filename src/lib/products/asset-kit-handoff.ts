import type { LayerData, LayerType, SemanticId } from "../magic-layers/types.ts";
import { imageSetSubtypeLabel } from "./image-set-subtype-labels";
import type { ImageSetCategory } from "./image-set-kit.ts";

export type AssetKitHandoff = { productId: string; batchId: string; assetIds: string[] };
export type MagicLayersSeed = {
  layers: LayerData[];
  docW: number;
  docH: number;
  clientId?: string;
  title?: string;
  subtitle?: string;
  assetKit?: AssetKitHandoff;
};

export type HandoffKitAsset = {
  id: string;
  category: ImageSetCategory | null;
  assetSubtype: string | null;
  imageUrl: string;
  status: string;
};

export function parseMagicLayersSeed(raw: string): MagicLayersSeed | null {
  try {
    const value = JSON.parse(raw) as Partial<MagicLayersSeed>;
    if (!Array.isArray(value.layers) || !Number.isFinite(value.docW) || !Number.isFinite(value.docH) || (value.docW ?? 0) <= 0 || (value.docH ?? 0) <= 0) return null;
    if (value.assetKit !== undefined && (
      !value.assetKit
      || typeof value.assetKit.productId !== "string"
      || typeof value.assetKit.batchId !== "string"
      || !Array.isArray(value.assetKit.assetIds)
      || !value.assetKit.assetIds.every((id) => typeof id === "string")
    )) return null;
    return value as MagicLayersSeed;
  } catch {
    return null;
  }
}

export function buildMagicLayersKitHandoff(input: {
  clientId: string;
  productId: string;
  batchId: string;
  assetIds: string[];
  title: string;
}): MagicLayersSeed {
  return {
    layers: [],
    docW: 1200,
    docH: 1200,
    clientId: input.clientId,
    title: input.title,
    assetKit: { productId: input.productId, batchId: input.batchId, assetIds: input.assetIds },
  };
}

function layerKind(category: ImageSetCategory | null): { type: LayerType; semanticId: SemanticId } {
  if (category === "product") return { type: "product", semanticId: "product" };
  if (category === "decoration") return { type: "decoration", semanticId: "decoration" };
  if (category === "background") return { type: "background", semanticId: "background" };
  return { type: "object", semanticId: "object" };
}

export function buildAssetKitSeedLayers(assets: HandoffKitAsset[], docW: number, docH: number): LayerData[] {
  const completed = assets.filter(({ status, imageUrl }) => status === "DONE" && !!imageUrl);
  const background = completed.find(({ category }) => category === "background");
  const foreground = completed.filter(({ id }) => id !== background?.id);
  const positions = [
    { x: 0.34, y: 0.23, w: 0.32, h: 0.54 },
    { x: 0.06, y: 0.08, w: 0.22, h: 0.22 },
    { x: 0.72, y: 0.08, w: 0.22, h: 0.22 },
    { x: 0.06, y: 0.70, w: 0.22, h: 0.22 },
    { x: 0.72, y: 0.70, w: 0.22, h: 0.22 },
  ];
  const ordered = background ? [background, ...foreground] : foreground;
  return ordered.map((asset, index) => {
    const isBackground = asset.id === background?.id;
    const position = isBackground ? { x: 0, y: 0, w: 1, h: 1 } : positions[isBackground ? 0 : index - (background ? 1 : 0)] ?? positions[positions.length - 1];
    const x = Math.round(position.x * docW);
    const y = Math.round(position.y * docH);
    const width = Math.round(position.w * docW);
    const height = Math.round(position.h * docH);
    const kind = layerKind(asset.category);
    return {
      id: `asset-kit-${asset.id}`,
      type: kind.type,
      semanticId: kind.semanticId,
      name: asset.assetSubtype ? imageSetSubtypeLabel(asset.assetSubtype).zh : "視覺套組素材",
      instanceId: `asset-kit-${index + 1}`,
      parentId: null,
      bbox: { x, y, w: width, h: height },
      mask: null,
      image: asset.imageUrl,
      x,
      y,
      width,
      height,
      rotation: 0,
      zIndex: isBackground ? 0 : index + 1,
      confidence: 1,
      source: "generated",
      editable: true,
      embeddedText: [],
      children: [],
      meta: { assetKit: true, assetId: asset.id, category: asset.category },
    };
  });
}
