import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ad layout keeps legacy calls on completed product assets newest first", async () => {
  const source = await readFile(new URL("./magic-layers/ad-layout/route.ts", import.meta.url), "utf8");

  assert.match(source, /: \{ status: "DONE" \}/);
  assert.match(source, /assets:\s*\{\s*where:\s*assetScope,\s*orderBy:\s*\{\s*createdAt:\s*"desc"\s*\}/);
});

test("ad layout scopes kit calls to product, batch, DONE status, and optional IDs", async () => {
  const source = await readFile(new URL("./magic-layers/ad-layout/route.ts", import.meta.url), "utf8");

  assert.match(source, /candidate\.productId !== productId/);
  assert.match(source, /status: "DONE", batchId: assetKit\.batchId/);
  assert.match(source, /id: \{ in: assetKit\.assetIds \}/);
  assert.match(source, /productImageSet\.findFirst\(\{ where: \{ id: assetKit\.batchId, productId \} \}\)/);
});

test("ad layout assesses the same target canvas used to prepare the background", async () => {
  const source = await readFile(new URL("./magic-layers/ad-layout/route.ts", import.meta.url), "utf8");

  assert.match(
    source,
    /assessAdLayoutVisualKit\(context,\s*\{\s*backgroundCanvas:\s*\{\s*width:\s*W,\s*height:\s*H\s*\},?\s*\}\)/,
  );
});
