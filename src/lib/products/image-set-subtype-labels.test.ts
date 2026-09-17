import assert from "node:assert/strict";
import test from "node:test";
import { imageSetSubtypeLabel } from "./image-set-subtype-labels.ts";
import { planImageSetRoles } from "./image-set-roles.ts";
import type { ProductVisualProfile } from "./product-visual-profile.ts";

test("every subtype the planner can emit has a Chinese display name", () => {
  // 防止日後新增變化卻忘了命名，畫面變成一半中文一半英文 key。
  const base: ProductVisualProfile = {
    version: 1,
    productType: "測試商品",
    productArchetype: "beauty_device",
    confidence: 0.9,
    appearance: {
      shape: "瓶",
      materials: ["塑膠"],
      colors: ["白"],
      distinctiveDetails: ["按壓頭"],
      visibleTextOrLogos: [],
    },
    useCases: ["日常保養"],
    suitableScenes: ["明亮浴室"],
    visualMotifs: [],
    prohibitedChanges: [],
    sourceImageCount: 1,
  };
  // 各 archetype 會走到不同的 detail 分支，全部掃過才不會漏掉某個變化。
  const profiles: ProductVisualProfile[] = ["beauty_device", "skincare", "cosmetics", "fashion", "unknown"]
    .map((productArchetype) => ({ ...base, productArchetype } as ProductVisualProfile));

  const subtypes = new Set<string>();
  for (const profile of profiles) {
    for (const role of planImageSetRoles(profile)) {
      const subtype = (role as { assetSubtype?: string }).assetSubtype;
      if (subtype) subtypes.add(subtype);
    }
  }
  assert.ok(subtypes.size > 0, "planner 應該至少產生一個 assetSubtype");

  for (const subtype of subtypes) {
    const label = imageSetSubtypeLabel(subtype);
    assert.notEqual(label.en, "", `${subtype} 沒有對應的顯示名稱`);
    assert.doesNotMatch(label.zh, /[a-z]-[a-z]|^[a-z ]+$/, `${subtype} 的中文名稱看起來還是英文 key：${label.zh}`);
    assert.notEqual(label.description, "", `${subtype} 缺少說明`);
  }
});

test("unknown subtypes degrade to a readable string instead of crashing", () => {
  const label = imageSetSubtypeLabel("brand-new-thing");
  assert.equal(label.zh, "brand new thing");
  assert.equal(label.en, "");
});
