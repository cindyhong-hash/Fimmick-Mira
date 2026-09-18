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
  /**
   * 賣點圖示的文字。icon 圖裡刻意不含任何字（影像模型畫中文會缺筆畫，
   * 實測被畫出過「雙重保濕」四個字），所以文字要在畫布上另外變成文字圖層，
   * 用真正的字型渲染。
   */
  benefitTitle?: string | null;
  benefitDescription?: string | null;
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

/**
 * 賣點圖示帶著標題與說明進畫布時，拆成三個圖層：icon 圖片、標題文字、說明文字。
 *
 * 三個都設 parentId 指向 icon，PSD 匯出時會成為同一組。編輯器目前沒有實作
 * 群組拖曳，所以在畫布上它們是各自獨立的圖層——這樣也剛好符合需求：
 * 版面窄的時候可以只留 icon 加標題，把說明刪掉。
 */
function benefitTextLayers(
  iconLayerId: string,
  asset: HandoffKitAsset,
  icon: { x: number; y: number; width: number; height: number; zIndex: number },
  doc: { w: number; h: number },
): LayerData[] {
  const title = asset.benefitTitle?.trim();
  if (!title) return [];
  // 字級綁畫布寬度，不要綁 icon 高度——icon 被放在主位時高達畫布的 54%，
  // 換算出來的標題會變成 100px 以上，而且整塊文字會被推到畫布外面。
  const rows: Array<{ suffix: string; text: string; size: number; weight: number }> = [
    { suffix: "title", text: title, size: Math.max(24, Math.round(doc.w * 0.045)), weight: 700 },
  ];
  const description = asset.benefitDescription?.trim();
  if (description) {
    rows.push({ suffix: "desc", text: description, size: Math.max(16, Math.round(doc.w * 0.03)), weight: 400 });
  }
  const lineHeights = rows.map((row) => Math.round(row.size * 1.4));
  const gap = Math.round(doc.h * 0.015);
  const blockHeight = lineHeights.reduce((sum, height) => sum + height, 0) + gap * rows.length;
  // 文字接在 icon 下面；若會超出畫布下緣就整塊往上移，寧可疊到 icon 也不要掉出畫面。
  const top = Math.min(icon.y + icon.height + gap, Math.max(0, doc.h - blockHeight));
  let cursor = top;
  return rows.map((row, index) => {
    const height = lineHeights[index];
    const y = cursor;
    cursor += height + gap;
    return {
      id: `${iconLayerId}-${row.suffix}`,
      type: "independent_text" as const,
      semanticId: "text" as const,
      name: row.text.slice(0, 14),
      instanceId: `${iconLayerId}-${row.suffix}`,
      // 關係記下來，PSD 匯出時三個會在同一組；編輯器目前不做群組拖曳。
      parentId: iconLayerId,
      bbox: { x: icon.x, y, w: icon.width, h: height },
      mask: null,
      image: null,
      x: icon.x,
      y,
      width: icon.width,
      height,
      rotation: 0,
      zIndex: icon.zIndex + index + 1,
      confidence: 1,
      source: "generated" as const,
      editable: true,
      embeddedText: [],
      children: [],
      meta: {
        assetKit: true,
        assetId: asset.id,
        benefitText: row.suffix,
        textObject: { text: row.text },
        style: {
          text: row.text,
          color: "#3C3C3C",
          fontWeight: row.weight,
          align: "center" as const,
          fontSizePx: row.size,
          fontFamily: "'Noto Sans TC','PingFang TC',system-ui,sans-serif",
        },
      },
    };
  });
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
  return ordered.flatMap((asset, index) => {
    const isBackground = asset.id === background?.id;
    const position = isBackground ? { x: 0, y: 0, w: 1, h: 1 } : positions[isBackground ? 0 : index - (background ? 1 : 0)] ?? positions[positions.length - 1];
    const x = Math.round(position.x * docW);
    const y = Math.round(position.y * docH);
    const width = Math.round(position.w * docW);
    const height = Math.round(position.h * docH);
    const kind = layerKind(asset.category);
    const iconLayerId = `asset-kit-${asset.id}`;
    const texts = benefitTextLayers(iconLayerId, asset, { x, y, width, height, zIndex: isBackground ? 0 : index + 1 }, { w: docW, h: docH });
    const layer: LayerData = {
      id: iconLayerId,
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
      children: texts.map(({ id }) => id),
      meta: { assetKit: true, assetId: asset.id, category: asset.category },
    };
    return [layer, ...texts];
  });
}
