import assert from "node:assert/strict";
import test from "node:test";
import {
  IMAGE_SET_MAX_ASSETS,
  deriveImageSetKitStatus,
  parseImageSetPlanJson,
  toImageSetCategory,
  toStoredAssetRole,
  type ImageSetPlanItem,
} from "./image-set-kit.ts";

const item = (overrides: Partial<ImageSetPlanItem> = {}): ImageSetPlanItem => ({
  id: "hero-clean",
  category: "product",
  assetRole: "hero",
  assetSubtype: "clean-cutout",
  purpose: "供版面主體與商品辨識使用",
  core: true,
  defaultSelected: true,
  ...overrides,
});

test("maps UI categories to canonical stored roles and reads legacy role aliases", () => {
  assert.equal(toStoredAssetRole("product"), "hero");
  assert.equal(toStoredAssetRole("texture"), "detail");
  assert.equal(toStoredAssetRole("background"), "background");
  assert.equal(toImageSetCategory("hero"), "product");
  assert.equal(toImageSetCategory("product"), "product");
  assert.equal(toImageSetCategory("detail"), "texture");
  assert.equal(toImageSetCategory("texture"), "texture");
  assert.equal(toImageSetCategory("unknown"), null);
});

test("parses a bounded valid image-set plan", () => {
  const plan = [
    item(),
    item({
      id: "detail-texture",
      category: "texture",
      assetRole: "detail",
      assetSubtype: "macro-texture",
      core: false,
    }),
  ];
  assert.deepEqual(parseImageSetPlanJson(JSON.stringify(plan)), plan);
});

test("rejects duplicate IDs, unknown roles, and blank subtype or purpose", () => {
  assert.throws(() => parseImageSetPlanJson(JSON.stringify([item(), item()])), /重複/);
  assert.throws(
    () => parseImageSetPlanJson(JSON.stringify([item({ assetRole: "unknown" as "hero" })])),
    /assetRole/,
  );
  assert.throws(() => parseImageSetPlanJson(JSON.stringify([item({ assetSubtype: "  " })])), /assetSubtype/);
  assert.throws(() => parseImageSetPlanJson(JSON.stringify([item({ purpose: "" })])), /purpose/);
});

test("rejects plans above the server asset limit", () => {
  const oversized = Array.from({ length: IMAGE_SET_MAX_ASSETS + 1 }, (_, index) => item({ id: `asset-${index}` }));
  assert.throws(() => parseImageSetPlanJson(JSON.stringify(oversized)), new RegExp(String(IMAGE_SET_MAX_ASSETS)));
});

test("derives aggregate kit status from the persisted asset rows", () => {
  assert.equal(deriveImageSetKitStatus(["PENDING", "DONE"]), "GENERATING");
  assert.equal(deriveImageSetKitStatus(["GENERATING", "FAILED"]), "GENERATING");
  assert.equal(deriveImageSetKitStatus(["DONE", "DONE"]), "COMPLETE");
  assert.equal(deriveImageSetKitStatus(["DONE", "FAILED"]), "PARTIAL");
  assert.equal(deriveImageSetKitStatus(["FAILED", "FAILED"]), "FAILED");
});
