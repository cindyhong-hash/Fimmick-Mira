import assert from "node:assert/strict";
import test from "node:test";
import {
  IMAGE_SET_MAX_ASSETS,
  deriveImageSetKitStatus,
  normalizeImageSetKitAssets,
  parseImageSetPlanJson,
  toImageSetCategory,
  toStoredAssetRole,
  type ImageSetPlanItem,
} from "./image-set-kit.ts";

test("kit assets are normalized only from the requested product and batch", () => {
  const base = {
    assetRole: "detail", assetSubtype: "macro", status: "DONE", imageUrl: "/detail.png",
    errorMessage: null, hasTransparentBackground: false,
  };
  const assets = normalizeImageSetKitAssets("product-a", "batch-a", [
    { ...base, id: "kept", productId: "product-a", batchId: "batch-a" },
    { ...base, id: "other-batch", productId: "product-a", batchId: "batch-b" },
    { ...base, id: "other-product", productId: "product-b", batchId: "batch-a" },
  ]);
  assert.deepEqual(assets.map(({ id, category, status }) => ({ id, category, status })), [
    { id: "kept", category: "texture", status: "DONE" },
  ]);
});

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

test("carries the benefit icon style through planJson so confirm can restore it", () => {
  // 風格只影響提示詞，不影響 id／角色／子型別，所以確認階段的比對關卡抓不到
  // 風格不符。唯一的還原來源就是這個欄位——它必須完整存進去也讀得回來。
  const withStyle = item({ id: "benefit-icon-1", category: "benefit", assetRole: "benefit", benefitIconStyle: "soft" });
  assert.deepEqual(parseImageSetPlanJson(JSON.stringify([withStyle])), [withStyle]);

  // 舊批次沒有這個欄位，不能當成壞資料。
  const legacy = item({ id: "benefit-icon-1", category: "benefit", assetRole: "benefit" });
  assert.deepEqual(parseImageSetPlanJson(JSON.stringify([legacy])), [legacy]);

  // 但認不得的值要炸，不能默默退回預設——那會生出跟規劃時不同風格的圖。
  assert.throws(
    () => parseImageSetPlanJson(JSON.stringify([{ ...withStyle, benefitIconStyle: "sketch" }])),
    /賣點圖示風格/,
  );
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
