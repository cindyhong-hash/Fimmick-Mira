import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { badgeBackgroundColour, renderBenefitBadge } from "./benefit-badge.ts";
import type { ImageSetArtDirection } from "./product-visual-analysis.ts";

const direction = (accent: string[], dominant: string[] = []): ImageSetArtDirection => ({
  concept: "c", palette: { dominant, accent }, lighting: "l", materials: [],
  backgroundLanguage: "b", cameraLanguage: "c", consistencyRules: [], mood: [], decorationStyle: [],
});

/** 白底上的一個深色方塊——模擬模型交回來的剪影。 */
async function silhouette(size = 512, box = 160): Promise<Buffer> {
  const offset = Math.round((size - box) / 2);
  return sharp({ create: { width: size, height: size, channels: 3, background: "#ffffff" } })
    .composite([{
      input: await sharp({ create: { width: box, height: box, channels: 3, background: "#222222" } }).png().toBuffer(),
      top: offset, left: offset,
    }])
    .png()
    .toBuffer();
}

async function pixel(png: Buffer, x: number, y: number) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

test("a badge is composed at a fixed size and colour, whatever the model drew", async () => {
  // 模型每次畫的剪影大小不同，但合成出來的圓必須完全一樣——這正是「兩張徽章
  // 一大一小、藍色深淺不同」要解決的問題。
  const small = await renderBenefitBadge(await silhouette(512, 80), "#3A7BD5");
  const large = await renderBenefitBadge(await silhouette(512, 300), "#3A7BD5");
  assert.ok(small && large);

  for (const badge of [small, large]) {
    const meta = await sharp(badge).metadata();
    assert.equal(meta.width, 1024);
    assert.equal(meta.height, 1024);
    // 圓直徑固定佔畫布 60%：左右各 20% 之外是白的，圓內是指定的顏色。
    const outside = await pixel(badge, 40, 512);
    assert.deepEqual([outside.r, outside.g, outside.b], [255, 255, 255], "圓外不是白的");
    const onCircle = await pixel(badge, 230, 512);
    assert.deepEqual([onCircle.r, onCircle.g, onCircle.b], [0x3a, 0x7b, 0xd5], "圓的顏色或大小不對");
  }
  // 剪影一律縮到同一個佔比，所以兩張的中心都是白色圖形。
  // 中間灰要被拉成全不透明，否則炭灰剪影會被底色染成淡藍。
  const centreSmall = await pixel(small, 512, 512);
  const centreLarge = await pixel(large, 512, 512);
  assert.deepEqual([centreSmall.r, centreSmall.g, centreSmall.b], [255, 255, 255]);
  assert.deepEqual([centreLarge.r, centreLarge.g, centreLarge.b], [255, 255, 255]);
});

test("a blank sheet from the model composes nothing, so the caller keeps the original", async () => {
  const blank = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#ffffff" } }).png().toBuffer();
  assert.equal(await renderBenefitBadge(blank, "#3A7BD5"), null);
});

test("the badge colour is darkened until a white silhouette can be read on it", () => {
  // 品牌點綴色常常很淺（這個專案是 #ffeb85），白色剪影疊上去會看不見。
  const pale = badgeBackgroundColour(direction(["#ffeb85"]));
  assert.notEqual(pale.toLowerCase(), "#ffeb85");
  const { r, g, b } = { r: parseInt(pale.slice(1, 3), 16), g: parseInt(pale.slice(3, 5), 16), b: parseInt(pale.slice(5, 7), 16) };
  assert.ok((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 <= 0.62, `太亮了：${pale}`);

  // 已經夠深的顏色原封不動。
  assert.equal(badgeBackgroundColour(direction(["#3A7BD5"])).toLowerCase(), "#3a7bd5");
  // 點綴色沒有色碼就往主色找，都沒有就用預設值——不能因此整個壞掉。
  assert.equal(badgeBackgroundColour(direction(["light blue"], ["#2E5E8F"])).toLowerCase(), "#2e5e8f");
  assert.match(badgeBackgroundColour(direction(["light blue"], ["navy"])), /^#[0-9a-f]{6}$/i);
});

test("the badge takes its colour from the campaign, falling back to the brand", () => {
  // 選了檔期卻拿到一樣的金色徽章，整組素材就看不出跟主題有關。
  const brandOnly = direction(["#ffeb85"]);
  const withoutTheme = badgeBackgroundColour(brandOnly);
  const valentine = badgeBackgroundColour(brandOnly, "520 告白日");
  const christmas = badgeBackgroundColour(brandOnly, "耶誕節");

  assert.notEqual(valentine, withoutTheme, "選了檔期卻還是品牌色");
  assert.notEqual(valentine, christmas, "不同檔期應該有不同顏色");
  // 認不得的檔期、或沒選檔期，都退回品牌色——不能因此壞掉。
  assert.equal(badgeBackgroundColour(brandOnly, "不存在的檔期"), withoutTheme);
  assert.equal(badgeBackgroundColour(brandOnly, null), withoutTheme);
});
