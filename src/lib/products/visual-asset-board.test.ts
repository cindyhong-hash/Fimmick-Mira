import assert from "node:assert/strict";
import test from "node:test";
import { buildAssetKitSelection, groupVisualAssetBoardAssets, visualAssetBoardCounts } from "./visual-asset-board.ts";

const assets = [
  { id: "hero", category: "product" as const, status: "DONE" },
  { id: "detail", category: "texture" as const, status: "DONE" },
  { id: "failed", category: "decoration" as const, status: "FAILED" },
  { id: "working", category: "background" as const, status: "GENERATING" },
];

test("visual asset board groups assets and reports real lifecycle counts", () => {
  const groups = groupVisualAssetBoardAssets(assets);
  assert.deepEqual(Object.keys(groups), ["product", "texture", "decoration", "background"]);
  assert.deepEqual(visualAssetBoardCounts(assets), { total: 4, done: 2, failed: 1, active: 1 });
});

test("visual asset board CTA carries client, product, batch, and completed asset IDs", () => {
  assert.deepEqual(buildAssetKitSelection({ clientId: "client-a", productId: "product-a", batchId: "batch-a", assets }), {
    clientId: "client-a", productId: "product-a", batchId: "batch-a", assetIds: ["hero", "detail"],
  });
});
