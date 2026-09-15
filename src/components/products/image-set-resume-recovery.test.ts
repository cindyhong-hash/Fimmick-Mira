import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isCompleteImageSetResume } from "../../lib/products/image-set-ui.ts";

test("incomplete resume recovery offers a discard-and-restart path", async () => {
  const source = await readFile(new URL("./ImageSetModal.tsx", import.meta.url), "utf8");

  assert.match(source, /丟棄這批重新開始/);
  assert.match(source, /clearSavedImageSetBatch\(window\.localStorage, productId\)/);
  assert.match(source, /setResumeRecovery\(null\)/);
  assert.match(source, /void loadInitial\(\)/);
});

test("a saved batch that references a missing LibraryImage row reaches resume recovery", async () => {
  const source = await readFile(new URL("./ImageSetModal.tsx", import.meta.url), "utf8");
  const savedIds = ["row-hero", "row-background", "row-decoration"];
  const returnedIds = ["row-hero", "row-decoration"];

  assert.equal(isCompleteImageSetResume(savedIds, returnedIds), false);
  assert.match(source, /if \(!loaded\.complete\)/);
  assert.match(source, /既有套圖進度資料尚未完整，請重新讀取。/);
  assert.match(source, /setRecoveryKind\("resume"\)/);
});
