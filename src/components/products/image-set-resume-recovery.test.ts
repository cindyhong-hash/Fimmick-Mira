import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { reconcileImageSetResumeRows } from "../../lib/products/image-set-ui.ts";

test("incomplete resume recovery offers a discard-and-restart path", async () => {
  const source = await readFile(new URL("./ImageSetModal.tsx", import.meta.url), "utf8");

  assert.match(source, /丟棄這批重新開始/);
  assert.match(source, /clearSavedImageSetBatch\(window\.localStorage, productId\)/);
  assert.match(source, /setResumeRecovery\(null\)/);
  assert.match(source, /void loadInitial\(\)/);
});

test("closing a terminal image-set modal clears its resume record before the next opening", async () => {
  const source = await readFile(new URL("./ImageSetModal.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /const requestClose = \(\) => \{[\s\S]*if \(creatingRows\) return;[\s\S]*if \(phase === "done"\) clearSavedImageSetBatch\(window\.localStorage, productId\);[\s\S]*onClose\(\)/,
  );
});

test("a saved batch that references a missing LibraryImage row keeps the surviving progress", async () => {
  const source = await readFile(new URL("./ImageSetModal.tsx", import.meta.url), "utf8");
  const reconciled = reconcileImageSetResumeRows(
    [
      { id: "row-hero", role: "hero", label: "商品主視覺" },
      { id: "row-background", role: "background", label: "情境空景" },
    ],
    [{ id: "row-hero", role: "hero", label: "商品主視覺", status: "DONE" }],
  );

  assert.equal(reconciled.missingCount, 1);
  assert.equal(reconciled.rows.length, 2);
  assert.match(source, /reconcileImageSetResumeRows/);
  assert.doesNotMatch(source, /if \(!loaded\.complete\)/);
  assert.doesNotMatch(source, /既有套圖進度資料尚未完整，請重新讀取。/);
  assert.match(source, /!item\.missing/);
  assert.match(source, /這批有素材已被刪除；其餘素材已保留，請丟棄舊批次後重新開始。/);
  assert.match(source, /missingResumeCount \? "丟棄這批重新開始"/);
});
