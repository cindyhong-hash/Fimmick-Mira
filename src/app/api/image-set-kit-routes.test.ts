import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("free image-set planning persists a DRAFT without invoking paid generation", async () => {
  const source = await readFile(new URL("./products/[productId]/image-set/plan/route.ts", import.meta.url), "utf8");

  assert.match(source, /db\.product\.findUnique/);
  assert.match(source, /planProductImageSet/);
  assert.match(source, /db\.productImageSet\.create/);
  assert.doesNotMatch(source, /protectPaidRoute|runImageSetBatch|generateImageSetRole|claimProductPaidOperationLease/);
});

test("paid image-set generation consumes and confirms a persisted DRAFT", async () => {
  const source = await readFile(new URL("./products/[productId]/image-set/route.ts", import.meta.url), "utf8");

  assert.match(source, /protectPaidRoute/);
  assert.match(source, /confirmAndScheduleProductImageSet/);
  assert.match(source, /productImageSet\.findFirst/);
  assert.match(source, /status: "DRAFT"/);
  assert.match(source, /status: "CONFIRMED"/);
  assert.match(source, /status: "GENERATING"/);
  assert.match(source, /selectedItemIds/);
  assert.match(source, /planJson: data\.planJson/);
  assert.doesNotMatch(source, /selectedRoles|requestSourceHash/);
});
