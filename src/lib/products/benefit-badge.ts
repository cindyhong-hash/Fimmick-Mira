import sharp from "sharp";
import type { ImageSetArtDirection } from "./product-visual-analysis.ts";
import { imageSetThemeHex } from "./image-set-theme-visuals.ts";

/**
 * 圓底徽章由程式合成，不讓模型畫圓。
 *
 * 每張 icon 是獨立一次 API 呼叫，模型看不到同組的其他張，所以「整組用同一個
 * 顏色、同一個大小」對它來說沒有參照物——實測兩張徽章一大一小、藍色深淺不同。
 * 這跟先前「請保持風格一致」「請共用同一個主體」失效是同一件事。
 *
 * 徽章其實只有兩個部分：一個純色圓、一個白色剪影。圓完全不需要 AI，
 * 所以改成模型只畫白底上的深色剪影，圓與位置由這裡用固定數字畫出來。
 * 結果是每一張的圓大小、顏色、剪影佔比都完全相同。
 */

/** 輸出邊長；跟生成的方形素材一致。 */
const CANVAS = 1024;
/** 圓直徑佔畫布的比例。 */
const CIRCLE_RATIO = 0.6;
/** 剪影最長邊佔圓直徑的比例，留出圓內邊距。 */
const SILHOUETTE_RATIO = 0.5;
/** 低於這個 alpha 視為背景，用來算剪影的邊界。 */
const EDGE_ALPHA = 20;
/** 灰階到這個值（含）以下就算實心剪影；再亮的部分當成邊緣漸層。 */
const SOLID_GREY = 128;
/** 白色剪影要看得清楚，所以底色不能太亮。 */
const MAX_BACKGROUND_LUMINANCE = 0.62;

const HEX = /^#?([0-9a-f]{6})$/i;

function parseHex(value: string): { r: number; g: number; b: number } | null {
  const match = HEX.exec(value.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * 挑徽章底色。
 *
 * 選了檔期就用檔期的顏色——不然選 520 告白日跟選耶誕節會拿到一樣的金色徽章，
 * 整組素材看不出跟主題有關。沒有檔期（常態品牌素材）才退回品牌色。
 *
 * 品牌點綴色常常很淺（這個專案是 #ffeb85），白色剪影疊上去會看不見，
 * 所以壓暗到剪影讀得出來為止——寧可顏色偏離一點，也不要看不到圖形。
 */
export function badgeBackgroundColour(
  artDirection: ImageSetArtDirection,
  themeLabel?: string | null,
  fallback = "#8FB8DE",
): string {
  const themeHex = imageSetThemeHex(themeLabel);
  const candidates = themeHex
    ? [themeHex]
    : [...artDirection.palette.accent, ...artDirection.palette.dominant];
  const rgb = candidates.map((value) => parseHex(value)).find((value): value is NonNullable<typeof value> => !!value)
    ?? parseHex(fallback)!;
  let current = rgb;
  // 每次壓暗 12%，最多十次就一定低於門檻，不會無限迴圈。
  for (let i = 0; i < 10 && relativeLuminance(current) > MAX_BACKGROUND_LUMINANCE; i += 1) {
    current = { r: current.r * 0.88, g: current.g * 0.88, b: current.b * 0.88 };
  }
  return toHex(current);
}

/** 生成圖是白底深色剪影；把它轉成白色剪影＋透明背景，並回報內容邊界。 */
async function extractSilhouette(source: Buffer): Promise<{ png: Buffer; width: number; height: number } | null> {
  const { data, info } = await sharp(source)
    .resize(CANVAS, CANVAS, { fit: "inside" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const rgba = Buffer.alloc(width * height * 4);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const grey = data[(y * width + x) * channels];
      // 白底 → alpha 0，深色剪影 → alpha 255。
      // 中間灰要拉成全不透明，否則炭灰的剪影會半透明、被底色染成淡藍；
      // 只有接近白的邊緣保留漸層，這樣抗鋸齒還在、圖形本身是實心白。
      const alpha = grey <= SOLID_GREY
        ? 255
        : Math.round(((255 - grey) * 255) / (255 - SOLID_GREY));
      const out = (y * width + x) * 4;
      rgba[out] = 255;
      rgba[out + 1] = 255;
      rgba[out + 2] = 255;
      rgba[out + 3] = alpha;
      if (alpha > EDGE_ALPHA) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  // 整張都是白的（模型沒畫東西）就放棄合成，讓呼叫端保留原圖。
  if (maxX < minX || maxY < minY) return null;

  const cropped = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
  return { png: cropped, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * 把生成的剪影貼進一個固定尺寸、固定顏色的圓。
 *
 * @returns 合成後的 PNG；剪影抽不出來時回 null，呼叫端應保留原圖。
 */
export async function renderBenefitBadge(source: Buffer, backgroundColour: string): Promise<Buffer | null> {
  const silhouette = await extractSilhouette(source);
  if (!silhouette) return null;

  const diameter = Math.round(CANVAS * CIRCLE_RATIO);
  const target = Math.round(diameter * SILHOUETTE_RATIO);
  const scale = target / Math.max(silhouette.width, silhouette.height);
  const drawWidth = Math.max(1, Math.round(silhouette.width * scale));
  const drawHeight = Math.max(1, Math.round(silhouette.height * scale));

  const resized = await sharp(silhouette.png).resize(drawWidth, drawHeight).png().toBuffer();
  const circle = Buffer.from(
    `<svg width="${CANVAS}" height="${CANVAS}" xmlns="http://www.w3.org/2000/svg">`
    + `<circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${diameter / 2}" fill="${backgroundColour}"/>`
    + `</svg>`,
  );

  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: "#ffffff" } })
    .composite([
      { input: circle, top: 0, left: 0 },
      {
        input: resized,
        top: Math.round((CANVAS - drawHeight) / 2),
        left: Math.round((CANVAS - drawWidth) / 2),
      },
    ])
    .png()
    .toBuffer();
}
