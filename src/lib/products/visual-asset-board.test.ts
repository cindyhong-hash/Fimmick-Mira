import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildAssetKitSelection, buildVisualAssetKitHistory, groupVisualAssetBoardAssets, visualAssetBoardCounts } from "./visual-asset-board.ts";

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

test("visual asset kit history keeps batches separate and derives live summaries", () => {
  const kits = [
    { id: "new-kit", themeKey: "moon", themeLabel: "中秋節", status: "COMPLETE", createdAt: "2026-09-16T08:00:00.000Z", confirmedAt: "2026-09-16T08:01:00.000Z" },
    { id: "old-kit", themeKey: null, themeLabel: null, status: "GENERATING", createdAt: "2026-09-15T08:00:00.000Z", confirmedAt: "2026-09-15T08:01:00.000Z" },
  ];
  const rows = [
    { batchId: "new-kit", status: "DONE", imageUrl: "https://example.com/hero.png" },
    { batchId: "new-kit", status: "FAILED", imageUrl: "" },
    { batchId: "old-kit", status: "GENERATING", imageUrl: "" },
    { batchId: "another-kit", status: "DONE", imageUrl: "https://example.com/other.png" },
  ];

  assert.deepEqual(buildVisualAssetKitHistory(kits, rows), [
    {
      id: "new-kit",
      theme: { key: "moon", label: "中秋節" },
      status: "PARTIAL",
      createdAt: "2026-09-16T08:00:00.000Z",
      confirmedAt: "2026-09-16T08:01:00.000Z",
      counts: { total: 2, done: 1, failed: 1, active: 0 },
      previewUrls: ["https://example.com/hero.png"],
    },
    {
      id: "old-kit",
      theme: null,
      status: "GENERATING",
      createdAt: "2026-09-15T08:00:00.000Z",
      confirmedAt: "2026-09-15T08:01:00.000Z",
      counts: { total: 1, done: 0, failed: 0, active: 1 },
      previewUrls: [],
    },
  ]);
});

test("product page exposes persistent kit history and routes back into each board", async () => {
  const source = await readFile(new URL("../../app/clients/[clientId]/products/[productId]/page.tsx", import.meta.url), "utf8");

  assert.match(source, /\/api\/products\/\$\{productId\}\/image-sets\?clientId=/);
  assert.match(source, /產品視覺套組/);
  assert.match(source, /image-sets\/\$\{kit\.id\}/);
});

test("product page can delete a whole kit without opening its history card", async () => {
  const source = await readFile(new URL("../../app/clients/[clientId]/products/[productId]/page.tsx", import.meta.url), "utf8");

  assert.match(source, /removeKit/);
  assert.match(source, /stopPropagation\(\)/);
  assert.match(source, /image-set\/\$\{kit\.id\}\?clientId=/);
  assert.match(source, /method: "DELETE"/);
  assert.match(source, /刪除整組/);
});

test("visual asset board exposes zoom, download, and per-image deletion", async () => {
  const source = await readFile(new URL("../../components/products/VisualAssetBoard.tsx", import.meta.url), "utf8");

  assert.match(source, /aria-label="素材放大檢視"/);
  assert.match(source, /setSelectedAsset\(asset\)/);
  assert.match(source, /href=\{selectedAsset\.imageUrl\} download/);
  assert.match(source, /remove\(selectedAsset\)/);
  assert.match(source, /method: "DELETE"/);
});

test("visual asset board can delete the whole kit and return to the product", async () => {
  const source = await readFile(new URL("../../components/products/VisualAssetBoard.tsx", import.meta.url), "utf8");

  assert.match(source, /removeKit/);
  assert.match(source, /image-set\/\$\{batchId\}\?clientId=/);
  assert.match(source, /method: "DELETE"/);
  assert.match(source, /router\.push\(`\/clients\/\$\{clientId\}\/products\/\$\{productId\}`\)/);
  assert.match(source, /刪除整組/);
});
