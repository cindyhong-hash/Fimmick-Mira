import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdLayoutDesignSpecs } from "./ad-layout-design-spec.ts";
import { evaluateAdLayout, repairAdLayoutSpec } from "./ad-layout-scoring.ts";

test("scores and deterministically removes support that competes with three benefits", () => {
  const [base] = resolveAdLayoutDesignSpecs({ canvas: { width: 1024, height: 1280, ratio: "4:5" }, assets: { hero: "hero", detail: "detail" }, purpose: "benefit", benefits: [{ id: "a", text: "保濕" }, { id: "b", text: "柔嫩" }, { id: "c", text: "舒緩" }], typography: { dark: "#123", light: "#fff", accent: "#68bbee" } });
  const invalid = { ...base, assets: { ...base.assets, support: { role: "detail" as const, imageUrl: "detail" } } };
  assert.ok(evaluateAdLayout(invalid).hardFailures.includes("support-benefit-conflict"));
  assert.equal(repairAdLayoutSpec(invalid).assets.support, undefined);
});
