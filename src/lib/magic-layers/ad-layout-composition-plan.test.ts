import assert from "node:assert/strict";
import test from "node:test";
import { resolveCompositionPlan } from "./ad-layout-composition-plan.ts";

const input = {
  canvas: { width: 1024, height: 1280, ratio: "4:5" },
  purpose: "scene" as const,
};

test("maps each visible direction to a product-first bounded strategy", () => {
  assert.equal(resolveCompositionPlan(input, "product-focus").strategy, "product-hero");
  assert.equal(resolveCompositionPlan(input, "editorial").strategy, "split-layout");
  assert.equal(resolveCompositionPlan(input, "scene-led").strategy, "scene-integrated");
});

test("reserves a benefit band without shrinking scene-led product zone below eight percent", () => {
  const plan = resolveCompositionPlan({ ...input, hasBenefits: true }, "scene-led");
  assert.deepEqual(plan.benefitZone, { x: 0.07, y: 0.80, w: 0.86, h: 0.13 });
  assert.ok(plan.productZone.w * plan.productZone.h >= 0.08);
  assert.ok(plan.productZone.y + plan.productZone.h <= plan.benefitZone!.y - 0.04);
});
