import test from "node:test";
import assert from "node:assert/strict";
import {
  assertValidArtDirection, assertFamilyIsVaried, auditTemplate, isDistinctEnough,
  measureNegativeSpace, negativeSpaceBand, type TemplateArtDirection,
} from "./template-design-system.ts";
import type { SavedLayer } from "./saved-layer.ts";

const C = 1200;
const layer = (over: Partial<SavedLayer>): SavedLayer => ({
  id: Math.random().toString(36).slice(2), name: "l", type: "object", zIndex: 0,
  x: 0, y: 0, w: 100, h: 100, rotation: 0, visible: true, opacity: 1, locked: false, ...over,
});

const ad = (over: Partial<TemplateArtDirection> = {}): TemplateArtDirection => ({
  name: "測試版", family: "editorial", composition: "asymmetrical-hero",
  visualHierarchy: ["product", "headline", "copy"],
  visualWeight: { product: 10, headline: 7, copy: 3 },
  readingDirection: "top-left→bottom-right", negativeSpace: 0.4,
  rationale: "商品錨在左下三分之一，超大標題佔住右上的留白，兩者拉出一條對角動線。",
  recommendedFor: "新品上市", ...over,
});

test("擋掉沒有層級的宣告", () => {
  assert.throws(() => assertValidArtDirection(ad({ visualHierarchy: ["product", "headline"] })), /至少要三層/);
  // 每個元素都 7 分＝沒有主配角
  assert.throws(() => assertValidArtDirection(ad({ visualWeight: { product: 7, headline: 7, copy: 7 } })), /落差不足/);
  // 宣告商品是主角，卻給標題最高分
  assert.throws(() => assertValidArtDirection(ad({ visualWeight: { product: 5, headline: 10, copy: 2 } })), /不是最高/);
});

test("擋掉只描述位置、不講構成的理由", () => {
  assert.throws(() => assertValidArtDirection(ad({ rationale: "商品放左邊、文字放右邊，下面一個按鈕。" })), /只描述了位置/);
  assert.throws(() => assertValidArtDirection(ad({ rationale: "很好看" })), /只描述了位置/);
  assert.doesNotThrow(() => assertValidArtDirection(ad()));
});

test("留白是量出來的，不是宣告就算", () => {
  // 畫布被四個大塊塞滿 → 實際留白接近 0，宣告 40% 要被抓出來
  const packed = [0, 600].flatMap((x) => [0, 600].map((y) => layer({ x, y, w: 600, h: 600 })));
  const audit = auditTemplate(ad({ negativeSpace: 0.4 }), packed, C);
  assert.equal(audit.ok, false);
  assert.match(audit.problems.join(), /宣告留白/);
  assert.ok(audit.measured.negativeSpace < 0.05);
});

test("重疊的圖層不會讓佔用面積超過 100%", () => {
  const stacked = Array.from({ length: 5 }, () => layer({ x: 100, y: 100, w: 400, h: 400 }));
  const ratio = measureNegativeSpace(stacked, C);
  assert.ok(ratio > 0.8 && ratio < 1, `疊在一起只該佔一塊，實際留白 ${ratio}`);
});

test("宣告商品是主角，標題卻比商品大 → 抓出來", () => {
  const layers = [
    layer({ image: "p.png", x: 500, y: 700, w: 200, h: 300 }),
    layer({ isText: true, fontSize: 160, x: 0, y: 0, w: 1200, h: 500, text: "大標" }),
    layer({ isText: true, fontSize: 30, x: 0, y: 520, w: 600, h: 80, text: "說明" }),
    layer({ x: 0, y: 620, w: 300, h: 4 }),
  ];
  assert.match(auditTemplate(ad({ negativeSpace: 0.5 }), layers, C).problems.join(), /比商品大/);
});

test("「圖左字右」對「圖右字左」不算兩個版型", () => {
  const a = ad({ name: "A" });
  const b = ad({ name: "B" });   // 完全一樣的設計決策
  assert.equal(isDistinctEnough(a, b), false);
  assert.throws(() => assertFamilyIsVaried([a, b]), /差異不足/);

  // 構成、主角、留白帶、動線都換過 → 才算真的不同
  const c = ad({
    name: "C", composition: "large-typography", visualHierarchy: ["headline", "product", "copy"],
    visualWeight: { headline: 10, product: 6, copy: 2 }, negativeSpace: 0.18,
    readingDirection: "top→bottom",
  });
  assert.equal(isDistinctEnough(a, c), true);
  assert.doesNotThrow(() => assertFamilyIsVaried([a, c]));
});

test("留白帶的分界", () => {
  assert.equal(negativeSpaceBand(0.55), "minimal");
  assert.equal(negativeSpaceBand(0.3), "balanced");
  assert.equal(negativeSpaceBand(0.15), "dense");
});
