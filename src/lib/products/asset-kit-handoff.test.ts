import assert from "node:assert/strict";
import test from "node:test";
import { buildAssetKitSeedLayers, buildMagicLayersKitHandoff, parseMagicLayersSeed } from "./asset-kit-handoff.ts";

test("Magic Layers accepts legacy seeds and rejects malformed optional kit data", () => {
  const legacy = JSON.stringify({ layers: [], docW: 1200, docH: 1200, clientId: "client-a" });
  assert.deepEqual(parseMagicLayersSeed(legacy), JSON.parse(legacy));
  assert.equal(parseMagicLayersSeed(JSON.stringify({ layers: [], docW: 1200, docH: 1200, assetKit: { productId: "p", batchId: "b", assetIds: "bad" } })), null);
  assert.equal(parseMagicLayersSeed("not-json"), null);
});

test("kit handoff carries ownership IDs and places assets at distinct useful coordinates", () => {
  const seed = buildMagicLayersKitHandoff({ clientId: "client-a", productId: "product-a", batchId: "batch-a", assetIds: ["bg", "hero", "detail"], title: "產品套組" });
  assert.deepEqual(seed.assetKit, { productId: "product-a", batchId: "batch-a", assetIds: ["bg", "hero", "detail"] });
  const layers = buildAssetKitSeedLayers([
    { id: "bg", category: "background", assetSubtype: "scene", imageUrl: "/bg.png", status: "DONE" },
    { id: "hero", category: "product", assetSubtype: "cutout", imageUrl: "/hero.png", status: "DONE" },
    { id: "detail", category: "texture", assetSubtype: "macro", imageUrl: "/detail.png", status: "DONE" },
  ], 1200, 1200);
  assert.deepEqual(layers[0].bbox, { x: 0, y: 0, w: 1200, h: 1200 });
  assert.equal(new Set(layers.map(({ x, y }) => `${x}:${y}`)).size, layers.length);
});

test("a benefit icon becomes three layers: the icon, its title and its description", () => {
  // icon 圖裡刻意不含任何字（影像模型畫中文會缺筆畫，實測被畫出過「雙重保濕」），
  // 所以文字要在畫布上變成真正的文字圖層，用字型渲染。
  const layers = buildAssetKitSeedLayers([
    {
      id: "icon-1",
      category: "benefit",
      assetSubtype: "benefit-icon-1",
      imageUrl: "/icon-1.png",
      status: "DONE",
      benefitTitle: "雙重保濕",
      benefitDescription: "鎖住肌膚水分",
    },
  ], 1200, 1200);

  assert.equal(layers.length, 3);
  const [icon, title, description] = layers;
  assert.equal(icon.image, "/icon-1.png");
  assert.equal(icon.type, "object");

  // 文字圖層要可編輯、有真正的字串，而且不是圖片。
  for (const layer of [title, description]) {
    assert.equal(layer.type, "independent_text");
    assert.equal(layer.semanticId, "text");
    assert.equal(layer.image, null);
    assert.equal(layer.editable, true);
    assert.equal(layer.parentId, icon.id, "文字要掛在 icon 底下，PSD 匯出才會是同一組");
  }
  assert.equal((title.meta.textObject as { text: string }).text, "雙重保濕");
  assert.equal((description.meta.textObject as { text: string }).text, "鎖住肌膚水分");
  assert.deepEqual(icon.children, [title.id, description.id]);
  // 文字排在 icon 下方，不要疊在圖上。
  assert.ok(title.y > icon.y + icon.height - 1);
  assert.ok(description.y > title.y);
  // 整塊文字必須留在畫布內，而且字級要合理——字級曾經綁在 icon 高度上，
  // 結果標題變成 104px、說明整層掉到畫布外面。
  assert.ok(description.y + description.height <= 1200, "文字掉出畫布下緣");
  const titleSize = (title.meta.style as { fontSizePx: number }).fontSizePx;
  assert.ok(titleSize >= 24 && titleSize <= 80, `標題字級不合理：${titleSize}`);
});

test("説明留空時只拆成兩層，沒有標題就完全不拆", () => {
  const base = { id: "icon-2", category: "benefit" as const, assetSubtype: "benefit-icon-2", imageUrl: "/icon-2.png", status: "DONE" };
  assert.equal(buildAssetKitSeedLayers([{ ...base, benefitTitle: "溫和去角質" }], 1200, 1200).length, 2);
  // 一般素材（背景、商品）沒有賣點文字，維持一張圖一個圖層。
  assert.equal(buildAssetKitSeedLayers([base], 1200, 1200).length, 1);
});
