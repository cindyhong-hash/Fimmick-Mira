import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdLayoutDesignSpecs } from "./ad-layout-design-spec.ts";

test("72-case matrix keeps product footprint and benefit hierarchy valid", () => {
  const ratios = [["1:1", 1024, 1024], ["4:5", 1024, 1280], ["9:16", 720, 1280]] as const;
  const purposes = ["product", "benefit", "scene", "promo"] as const;
  const rows: { ratio: string; purpose: string; aspect: number; direction: string; area: number; checks: ReturnType<typeof resolveAdLayoutDesignSpecs>[number]["quality"]["checks"] }[] = [];
  for (const [ratio, width, height] of ratios) for (const purpose of purposes) for (const aspect of [0.45, 0.65]) {
    for (const spec of resolveAdLayoutDesignSpecs({ canvas: { width, height, ratio }, purpose, productAspectRatio: aspect, assets: { hero: "hero", background: "background", detail: "detail" }, benefits: [{ id: "a", text: "48 小時保濕" }, { id: "b", text: "柔嫩觸感" }, { id: "c", text: "舒緩修護" }], typography: { headline: "每天細緻保養", dark: "#241f47", light: "#fff", accent: "#68bbee" } })) {
      rows.push({ ratio, purpose, aspect, direction: spec.direction, area: spec.layout!.product.w * spec.layout!.product.h / (width * height), checks: spec.quality.checks });
    }
  }
  assert.equal(rows.length, 72);
  assert.equal(rows.filter((row) => row.area < 0.08).length, 0, JSON.stringify(rows.filter((row) => row.area < 0.08)));
  assert.equal(rows.filter((row) => row.checks.some((check) => !check.passed && ["product-copy-overlap", "product-benefit-overlap", "support-benefit-conflict"].includes(check.id))).length, 0);
});
