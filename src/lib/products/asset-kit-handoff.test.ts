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
