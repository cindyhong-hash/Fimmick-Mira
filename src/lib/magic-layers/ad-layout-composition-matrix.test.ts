import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdLayoutDesignSpecs } from "./ad-layout-design-spec.ts";

test("72-case matrix keeps product footprint and benefit hierarchy valid", () => {
  const ratios = [["1:1", 1080, 1080], ["4:5", 1080, 1350], ["9:16", 1080, 1920]] as const;
  const purposes = ["product", "benefit", "scene", "promo"] as const;
  const rows: { ratio: string; purpose: string; aspect: number; direction: string; area: number; checks: ReturnType<typeof resolveAdLayoutDesignSpecs>[number]["quality"]["checks"] }[] = [];
  for (const [ratio, width, height] of ratios) for (const purpose of purposes) for (const aspect of [0.28, 0.45, 0.65, 2.4]) {
    for (const spec of resolveAdLayoutDesignSpecs({ canvas: { width, height, ratio }, purpose, productAspectRatio: aspect, assets: { hero: "hero", background: "background", detail: "detail" }, benefits: [{ id: "a", text: "48 小時保濕" }, { id: "b", text: "柔嫩觸感" }, { id: "c", text: "舒緩修護" }], typography: { headline: "每天細緻保養", dark: "#241f47", light: "#fff", accent: "#68bbee" } })) {
      rows.push({ ratio, purpose, aspect, direction: spec.direction, area: spec.layout!.product.w * spec.layout!.product.h / (width * height), checks: spec.quality.checks });
    }
  }
  assert.equal(rows.length, 144);
  assert.equal(rows.filter((row) => row.checks.some((check) => check.id === "product-footprint" && !check.passed)).length, 0, JSON.stringify(rows.filter((row) => row.checks.some((check) => check.id === "product-footprint" && !check.passed))));
  assert.equal(rows.filter((row) => row.checks.some((check) => !check.passed && ["product-copy-overlap", "product-benefit-overlap", "support-benefit-conflict"].includes(check.id))).length, 0);
});
