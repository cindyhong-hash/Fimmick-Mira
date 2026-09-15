# AI Ad Layout Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all three existing AI layout candidates produce an editable product-first composition with deterministic hierarchy, safe copy/benefit placement, and bounded recovery from invalid geometry.

**Architecture:** Introduce a normalized `CompositionPlan` before rendering and use it as the shared geometry contract. Deterministic prepared-background analysis and a scorecard evaluate named template variants, while vision remains a bounded source of scene hints only. Rendering receives pre-reserved product, copy, benefit, and optional support zones, then creates the existing editable layer format.

**Tech Stack:** TypeScript, Node test runner through `tsx`, Sharp image buffers, Next.js, existing Magic Layers `LayerData`.

**Spec:** `docs/superpowers/specs/2026-09-15-ai-ad-layout-composition-design.md`

## Global Constraints

- Keep the current three UI directions: `product-focus`, `editorial`, and `scene-led`.
- Preserve user-entered headline and all benefit strings in every accepted candidate.
- Do not generate images, invoke P4, click an image-generation control, or change `SHOW_AD_LAYOUT` defaults.
- Vision and art direction may select bounded variants but cannot return free-form layer coordinates.
- Use prepared final-canvas background pixels for deterministic analysis; retain existing final-canvas crop before vision.
- Keep `sceneGrounding` separate from optional validated `surfaceRect`.
- A product may not be accepted below 8% canvas area; scene-led matrix median must reach 10%.
- Limit deterministic repair to two changes, with no additional provider request or random placement.
- Preserve editable Magic Layers output and existing modal/editor flow.
- Run changed-file ESLint without adding errors. The known planner `content-brief` `subtitleText` fixture remains the only allowed full-suite failure.

---

## File map

| File | Change |
| --- | --- |
| `src/lib/magic-layers/ad-layout-composition-plan.ts` | New strategy/variant contract and normalized zone resolver. |
| `src/lib/magic-layers/ad-layout-composition-plan.test.ts` | New strategy mapping, benefit reservation, and zone-minimum tests. |
| `src/lib/magic-layers/ad-layout-background-analysis.ts` | New deterministic grid scoring for prepared final-canvas image data. |
| `src/lib/magic-layers/ad-layout-background-analysis.test.ts` | New fixture-buffer tests for contrast and texture selection. |
| `src/lib/magic-layers/ad-layout-scoring.ts` | New candidate scorecard, failure types, and bounded repair actions. |
| `src/lib/magic-layers/ad-layout-scoring.test.ts` | New score and repair-limit tests. |
| `src/lib/magic-layers/ad-layout-design-spec.ts` | Store plan, resolve assets by plan, apply scorecard/reflow. |
| `src/lib/magic-layers/ad-layout-composition.ts` | Fit the product into plan zones and use plan benefit geometry. |
| `src/lib/magic-layers/ad-layout-templates.ts` | Correct scene-led hero zones and bounded variants. |
| `src/lib/magic-layers/ad-layout-renderer.ts` | Render plan-owned benefit groups, contrast panels, and asset budget. |
| `src/lib/magic-layers/ad-layout-graphics.ts` | Split numeric claims into value and remainder. |
| `src/lib/magic-layers/ad-layout-quality.ts` | Add plan-aware hierarchy, footprint, zone, and collision checks. |
| `src/lib/magic-layers/ad-layout-polish.ts` | Replace fixed 8% growth with score-directed bounded repair. |
| `src/lib/magic-layers/ad-layout-art-direction.ts` | Parse supported values while safely ignoring unknown keys; then remove `graphics`. |
| `src/lib/products/image-set-roles.ts` | Tighten future background-role prompt; no provider invocation. |
| `src/lib/magic-layers/ad-layout-*.test.ts` | Extend existing focused tests for composition, renderer, quality, polish, graphics, and art direction. |
| `scripts/evaluate-ad-layout-composition.ts` | New deterministic 72-case matrix report and contact-sheet manifest. |

### Task 1: Composition contract and corrected scene-led variants

**Files:**
- Create: `src/lib/magic-layers/ad-layout-composition-plan.ts`
- Create: `src/lib/magic-layers/ad-layout-composition-plan.test.ts`
- Modify: `src/lib/magic-layers/ad-layout-templates.ts`
- Modify: `src/lib/magic-layers/ad-layout-design-spec.ts`

**Interfaces:**
- Produces `CompositionStrategy`, `CompositionPlan`, `resolveCompositionPlan(input, direction, decision)`, and `withReservedBenefitZone(plan, hasBenefits)`.
- `resolveAdComposition` consumes `input.compositionPlans?.[direction]` in Task 2.
- `AdLayoutDesignSpec.compositionPlan` is consumed by renderer, quality, polish, and scoring tasks.

- [ ] **Step 1: Write failing contract tests**

```ts
test("maps each visible direction to a product-first bounded strategy", () => {
  assert.equal(resolveCompositionPlan(input, "product-focus").strategy, "product-hero");
  assert.equal(resolveCompositionPlan(input, "editorial").strategy, "split-layout");
  assert.equal(resolveCompositionPlan(input, "scene-led").strategy, "scene-integrated");
});

test("reserves a benefit band without shrinking a scene product zone below 8 percent", () => {
  const plan = withReservedBenefitZone(resolveCompositionPlan(sceneInput, "scene-led"), true);
  assert.ok(plan.benefitZone);
  assert.ok(plan.productZone.w * plan.productZone.h >= 0.08);
  assert.ok(plan.productZone.y + plan.productZone.h <= plan.benefitZone.y);
});
```

- [ ] **Step 2: Run contract tests and verify failure**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-composition-plan.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Define the normalized plan API and named variants**

```ts
export type CompositionPlan = {
  strategy: "product-hero" | "split-layout" | "scene-integrated";
  variant: string;
  productZone: NormalizedRect;
  copyZone: NormalizedRect;
  benefitZone?: NormalizedRect;
  supportZone?: NormalizedRect;
  alignment: "left" | "center" | "right";
  productPlacement: "floating" | "surface-aligned";
};

export function withReservedBenefitZone(plan: CompositionPlan, hasBenefits: boolean): CompositionPlan {
  if (!hasBenefits) return plan;
  const benefitZone = { x: 0.07, y: 0.80, w: 0.86, h: 0.13 };
  const productBottom = Math.min(plan.productZone.y + plan.productZone.h, benefitZone.y - 0.04);
  return { ...plan, benefitZone, productZone: { ...plan.productZone, y: Math.min(plan.productZone.y, productBottom - plan.productZone.h) } };
}
```

Give `scene-copy-overlay` and `scene-product-corner` variants product zones that have at least `0.08` normalized area before benefits and leave a copy-safe zone separate from product. Keep templates named and direction-specific; do not replace `AD_LAYOUT_TEMPLATES` with free-form coordinates.

- [ ] **Step 4: Persist plan in design specs**

Add `compositionPlan?: CompositionPlan` to `AdLayoutDesignSpec` and `compositionPlans?: Partial<Record<AdLayoutDirection, CompositionPlan>>` to `AdLayoutDesignInput`. Resolve one plan per direction before calling `resolveAdComposition`, and store it on the resulting spec.

- [ ] **Step 5: Run focused tests**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-composition-plan.test.ts src/lib/magic-layers/ad-layout-design-spec.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/magic-layers/ad-layout-composition-plan.ts src/lib/magic-layers/ad-layout-composition-plan.test.ts src/lib/magic-layers/ad-layout-templates.ts src/lib/magic-layers/ad-layout-design-spec.ts
git commit -m "feat: add deterministic ad composition plans"
```

### Task 2: Plan-driven product geometry and surface fallback

**Files:**
- Modify: `src/lib/magic-layers/ad-layout-composition.ts`
- Modify: `src/lib/magic-layers/ad-layout-composition.test.ts`
- Modify: `src/lib/magic-layers/ad-layout-surface-guard.test.ts`

**Interfaces:**
- Consumes `CompositionPlan.productZone`, `copyZone`, and optional `benefitZone` from Task 1.
- Produces `ResolvedAdLayout` with `benefit?: LayoutRect` and the final aspect-preserved `product` rectangle.
- Task 4 consumes its final rectangles for rendering.

- [ ] **Step 1: Write failing geometry tests**

```ts
test("uses the plan benefit band by moving scene product before reducing it", () => {
  const layout = resolveAdComposition({ ...sceneInput, benefits, compositionPlans: { "scene-led": plan } }, "scene-led");
  assert.ok(layout.product.y + layout.product.h <= layout.benefit!.y);
  assert.ok(layout.product.w * layout.product.h / (1024 * 1280) >= 0.08);
});

test("abandons surface alignment that would reduce product below half planned area", () => {
  const layout = resolveAdComposition(inputWithHighSurface, "scene-led");
  assert.notEqual(layout.product.y + layout.product.h, Math.round(0.05 * 1280));
});
```

- [ ] **Step 2: Run geometry tests and verify failure**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-composition.test.ts src/lib/magic-layers/ad-layout-surface-guard.test.ts`  
Expected: FAIL because `ResolvedAdLayout` has no plan-owned benefit rectangle and composition ignores it.

- [ ] **Step 3: Fit product from the plan**

Replace direct hero-zone selection with the plan product zone when supplied. Convert normalized plan zones with the existing `rect` helper. Fit with `fitAspectWithin` semantics: choose the largest contained rectangle retaining the product aspect ratio. On benefits, translate the zone upward first; only reduce size when it cannot fit between top margin and benefit band. Return plan-owned headline, subtitle, support, and benefit rectangles in `ResolvedAdLayout`.

- [ ] **Step 4: Preserve grounded-placement safeguards**

Keep `MIN_GROUNDED_AREA_RATIO = 0.5`. Apply `surfaceRect` only when vision source is trusted and `sceneGrounding === "surface"`; constrain horizontal placement to the surface but return ungrounded planned geometry when its area would be under half the planned product area or below 8% of canvas.

- [ ] **Step 5: Run focused tests**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-composition.test.ts src/lib/magic-layers/ad-layout-surface-guard.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/magic-layers/ad-layout-composition.ts src/lib/magic-layers/ad-layout-composition.test.ts src/lib/magic-layers/ad-layout-surface-guard.test.ts
git commit -m "feat: fit ad products from composition plans"
```

### Task 3: Deterministic prepared-background analysis

**Files:**
- Create: `src/lib/magic-layers/ad-layout-background-analysis.ts`
- Create: `src/lib/magic-layers/ad-layout-background-analysis.test.ts`

**Interfaces:**
- Produces `analyzePreparedBackground(buffer, canvas): BackgroundAnalysis` and `scoreBackgroundRect(analysis, rect): BackgroundRectScore`.
- `BackgroundRectScore` has `contrast`, `texture`, `stability`, `safeForCopy`, and `needsPanel`.
- Task 5 consumes scores; it never calls a provider.

- [ ] **Step 1: Write failing buffer tests**

```ts
test("prefers a low-edge stable region for copy", async () => {
  const analysis = await analyzePreparedBackground(twoToneFixture, { width: 100, height: 100 });
  assert.equal(scoreBackgroundRect(analysis, { x: 0.55, y: 0.1, w: 0.3, h: 0.2 }).safeForCopy, true);
  assert.equal(scoreBackgroundRect(analysis, { x: 0.05, y: 0.1, w: 0.3, h: 0.2 }).needsPanel, true);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-background-analysis.test.ts`  
Expected: FAIL because analyzer module does not exist.

- [ ] **Step 3: Implement fixed-grid analysis**

Use `sharp` to read the already ratio-prepared buffer at a small fixed resolution such as 12×12. For each cell calculate average luminance, luminance variance, and adjacent-cell luminance difference. Normalize each metric to `[0, 1]`. `scoreBackgroundRect` aggregates covered cells and marks `needsPanel` when edge density or luminance variance exceeds the fixed copy threshold. Do not inspect remote URLs or make vision requests.

- [ ] **Step 4: Keep preparation ownership unchanged**

Pass the `Buffer` returned by the existing `prepareAdBackground` directly to `analyzePreparedBackground`. Do not change `prepareAdBackground`, its crop behavior, or any vision request path.

- [ ] **Step 5: Run focused tests**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-background-analysis.test.ts src/lib/magic-layers/ad-layout-data.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/magic-layers/ad-layout-background-analysis.ts src/lib/magic-layers/ad-layout-background-analysis.test.ts
git commit -m "feat: score prepared ad backgrounds deterministically"
```

### Task 4: Benefit rendering, numeric deduplication, and support budget

**Files:**
- Modify: `src/lib/magic-layers/ad-layout-graphics.ts`
- Modify: `src/lib/magic-layers/ad-layout-graphics.test.ts`
- Modify: `src/lib/magic-layers/ad-layout-renderer.ts`
- Modify: `src/lib/magic-layers/ad-layout-renderer.test.ts`
- Modify: `src/lib/magic-layers/ad-layout-design-spec.ts`

**Interfaces:**
- Produces `splitBenefitClaim(text): { value: string | null; description: string }`.
- Renderer consumes `spec.layout.benefit` and `spec.compositionPlan.benefitZone`.
- `assetPlan` removes optional support when `benefits.length === 3` unless plan variant sets `supportZone` and an explicit support policy.

- [ ] **Step 1: Write failing benefit tests**

```ts
test("splits numeric value from its description without duplicating text", () => {
  assert.deepEqual(splitBenefitClaim("48 小時保濕"), { value: "48 小時", description: "保濕" });
});

test("renders a three-benefit group in its plan band without a support image", () => {
  const layers = renderAdLayoutSpec(threeBenefitSpec);
  assert.equal(layers.some((layer) => layer.id === "texture_1" || layer.id === "benefit_1"), false);
  assert.equal((layers.find((layer) => layer.id === "benefit_text_hydration")?.meta.style as { text: string }).text, "長效保濕");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-graphics.test.ts src/lib/magic-layers/ad-layout-renderer.test.ts`  
Expected: FAIL because full benefit text still repeats numeric value and renderer still uses `height * 0.77`.

- [ ] **Step 3: Implement semantic split and plan-owned group geometry**

Keep `matchBenefitGraphic` for icon selection, but return parsed value/description through `splitBenefitClaim`. In renderer, derive x/y/cell sizes from `layout.benefit` rather than `width * 0.07` and `height * 0.77`. Assign all group members the existing `meta.groupId`. Render a value only when non-null and a description only when non-empty.

- [ ] **Step 4: Apply support-image policy before render**

In `resolveAdLayoutDesignSpecs`, set `assets.support = undefined` whenever three benefits exist. For fewer benefits, retain support only when `compositionPlan.supportZone` exists and the selected direction/plan explicitly allows one. Never allow more than one support asset.

- [ ] **Step 5: Extend semantic icon tests**

Add table-driven expectations for `溫和不刺激 → shield`, `柔嫩觸感 → texture`, and `舒緩修護 → repair`. Keep the existing adjacent-prefix negation behavior.

- [ ] **Step 6: Run focused tests**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-graphics.test.ts src/lib/magic-layers/ad-layout-renderer.test.ts src/lib/magic-layers/ad-layout-design-spec.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/magic-layers/ad-layout-graphics.ts src/lib/magic-layers/ad-layout-graphics.test.ts src/lib/magic-layers/ad-layout-renderer.ts src/lib/magic-layers/ad-layout-renderer.test.ts src/lib/magic-layers/ad-layout-design-spec.ts
git commit -m "feat: render planned benefit groups without duplicate claims"
```

### Task 5: Scorecard, quality constraints, and deterministic repair

**Files:**
- Create: `src/lib/magic-layers/ad-layout-scoring.ts`
- Create: `src/lib/magic-layers/ad-layout-scoring.test.ts`
- Modify: `src/lib/magic-layers/ad-layout-quality.ts`
- Modify: `src/lib/magic-layers/ad-layout-quality.test.ts`
- Modify: `src/lib/magic-layers/ad-layout-polish.ts`
- Modify: `src/lib/magic-layers/ad-layout-polish.test.ts`
- Modify: `src/lib/magic-layers/ad-layout-design-spec.ts`

**Interfaces:**
- Produces `evaluateAdLayout(spec, background?): AdLayoutEvaluation` with `score`, `checks`, `hardFailures`, and `repairs`.
- Produces `repairAdLayoutSpec(spec, evaluation): AdLayoutDesignSpec` which applies no more than two repairs.
- `validateAndRepairDesignSpec` delegates to these functions after product integration planning.

- [ ] **Step 1: Write failing scorecard tests**

```ts
test("hard-fails an undersized scene product", () => {
  const result = evaluateAdLayout(specWithProductArea(0.06));
  assert.ok(result.hardFailures.includes("product-footprint"));
});

test("removes competing support before trying a second reflow", () => {
  const repaired = repairAdLayoutSpec(threeBenefitSupportSpec, evaluateAdLayout(threeBenefitSupportSpec));
  assert.equal(repaired.assets.support, undefined);
  assert.ok(repaired.polishTreatment.reasons.length <= 2);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-scoring.test.ts src/lib/magic-layers/ad-layout-quality.test.ts src/lib/magic-layers/ad-layout-polish.test.ts`  
Expected: FAIL because the scorecard and bounded repair API do not exist.

- [ ] **Step 3: Add explicit check identifiers**

Extend `AdLayoutQualityCheck["id"]` with `product-footprint`, `benefit-zone`, `copy-safe-zone`, `product-benefit-overlap`, `support-benefit-conflict`, `group-alignment`, and `assigned-whitespace`. Each check must return a concrete Chinese user-facing message and a boolean based on final layout rectangles.

- [ ] **Step 4: Implement score and repair ordering**

Score starts at 100 and subtracts fixed weights per failed soft check. Hard failures are: product below 8%, copy/product overlap, copy outside assigned zone, product overlapping benefit zone, unassigned split field, and support with three benefits. Apply repairs in this order: remove conflicting support, add `light-panel` treatment for a failed copy score, grow/recenter product within its plan zone, then switch to same-strategy fallback variant. Stop after two changes and retain a warning if fallback is required.

- [ ] **Step 5: Replace fixed polish growth**

Replace `MAX_PRODUCT_SCALE = 1.08` as the only undersize response. Compute the required scale from target area, cap it by plan zone and collision guards, and record the exact rationale. Retain headline emphasis and decoration collision removal as separate repairs only when the two-repair limit permits them.

- [ ] **Step 6: Run focused tests**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-scoring.test.ts src/lib/magic-layers/ad-layout-quality.test.ts src/lib/magic-layers/ad-layout-polish.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/magic-layers/ad-layout-scoring.ts src/lib/magic-layers/ad-layout-scoring.test.ts src/lib/magic-layers/ad-layout-quality.ts src/lib/magic-layers/ad-layout-quality.test.ts src/lib/magic-layers/ad-layout-polish.ts src/lib/magic-layers/ad-layout-polish.test.ts src/lib/magic-layers/ad-layout-design-spec.ts
git commit -m "feat: score and repair ad layout hierarchy"
```

### Task 6: Backward-tolerant art direction and future background prompt

**Files:**
- Modify: `src/lib/magic-layers/ad-layout-art-direction.ts`
- Modify: `src/lib/magic-layers/ad-layout-art-direction.test.ts`
- Modify: `src/lib/products/image-set-roles.ts`
- Modify: `src/lib/products/image-set-roles.test.ts`

**Interfaces:**
- `parseArtDirection` accepts valid required fields and ignores unknown fields.
- `DirectionDecision` no longer has `graphics`; callers only consume supported composition, typography, density, support, decoration, accent, backdrop, and confidence fields.

- [ ] **Step 1: Write failing parser and prompt tests**

```ts
test("keeps a valid art-direction decision when a stale extra field is present", () => {
  assert.equal(parseArtDirection(JSON.stringify({ version: 1, directions: [{ ...validDirection, obsolete: "value" }, ...otherDirections ]))?.directions.length, 3);
});

test("background prompt requests one quiet product-free scene with a placement plane", () => {
  assert.match(backgroundRole.sceneCn, /不出現任何產品/);
  assert.match(backgroundRole.sceneCn, /留白|文字/);
  assert.match(backgroundRole.sceneCn, /放置商品|檯面|平面/);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-art-direction.test.ts src/lib/products/image-set-roles.test.ts`  
Expected: FAIL because strict key equality rejects unknown keys and the background prompt lacks explicit placement-plane constraints.

- [ ] **Step 3: Implement parser-first migration**

Parse root and direction records as objects, read only known required keys, validate their values, and construct a fresh `DirectionDecision`; ignore unknown keys. Remove `graphics` from `DirectionDecision`, `DECISION_OPTIONS`, provider prompt schema, and tests only after unknown-key tolerance passes.

- [ ] **Step 4: Tighten the role prompt without generation**

Update only the background `sceneCn` prompt to request a single coherent, product-free scene; contiguous quiet copy space; visible product placement plane; and no split screen, dominant mirror/sink, or competing prop. Do not alter orchestrator calls or invoke any provider.

- [ ] **Step 5: Run focused tests**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-art-direction.test.ts src/lib/magic-layers/ad-layout-art-direction-policy.test.ts src/lib/products/image-set-roles.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/magic-layers/ad-layout-art-direction.ts src/lib/magic-layers/ad-layout-art-direction.test.ts src/lib/products/image-set-roles.ts src/lib/products/image-set-roles.test.ts
git commit -m "fix: tolerate stale art direction fields"
```

### Task 7: Matrix evaluator, visual evidence, and complete verification

**Files:**
- Create: `scripts/evaluate-ad-layout-composition.ts`
- Create: `src/lib/magic-layers/ad-layout-composition-matrix.test.ts`

**Interfaces:**
- Matrix calls `resolveAdLayoutDesignSpecs` with local fixture assets only.
- Produces JSON rows with `productArea`, `direction`, `purpose`, `ratio`, `hardFailures`, `copyInBounds`, `copyProductOverlap`, `benefitCount`, `duplicateNumericClaim`, and `supportImageCount`.

- [ ] **Step 1: Write failing matrix assertions**

```ts
test("the 72-case matrix has no accepted product below eight percent", () => {
  const rows = evaluateMatrix();
  assert.equal(rows.length, 72);
  assert.equal(rows.filter((row) => row.productArea < 0.08).length, 0);
  assert.ok(median(rows.filter((row) => row.direction === "scene-led").map((row) => row.productArea)) >= 0.10);
});

test("matrix candidates never duplicate a numeric benefit or add support for three benefits", () => {
  for (const row of evaluateMatrix()) {
    assert.equal(row.duplicateNumericClaim, false);
    if (row.benefitCount === 3) assert.equal(row.supportImageCount, 0);
  }
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx tsx --test src/lib/magic-layers/ad-layout-composition-matrix.test.ts`  
Expected: FAIL because matrix evaluator does not exist.

- [ ] **Step 3: Implement deterministic 72-case evaluation**

Define two local fixture product profiles, ratios `1:1`, `4:5`, `9:16`, all four purposes, and all three directions. Feed fixed local fixture URLs or stand-in identifiers through the regular design-spec pipeline. Count duplicate number output by comparing each benefit number layer with its rendered description. Write a JSON report and an HTML/contact-sheet manifest under a gitignored local evaluation output directory; do not fetch images or call the API.

- [ ] **Step 4: Run matrix and inspect report**

Run: `npx tsx scripts/evaluate-ad-layout-composition.ts`  
Expected: 72 rows, zero hard failures, zero copy bounds/collision failures, scene-led median product area at least `0.10`, no duplicate numeric claims, and zero support images for three-benefit cases.

- [ ] **Step 5: Run complete checks**

Run:

```bash
npx tsc --noEmit
npx next build
npx tsx --test "src/lib/**/*.test.ts" "src/app/**/*.test.ts"
npx eslint src/lib/magic-layers/ad-layout-*.ts src/lib/products/image-set-roles.ts
```

Expected: type-check and build pass; full suite has only the known planner `content-brief` fixture failure; changed-file ESLint adds no errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/evaluate-ad-layout-composition.ts src/lib/magic-layers/ad-layout-composition-matrix.test.ts
git commit -m "test: add ad layout composition matrix"
```

### Task 8: Manual non-generative visual validation and handoff

**Files:**
- Modify: `docs/AI-LAYOUT-REVIEW-2026-09-11.md` only to append measured validation results and commit references.

**Interfaces:**
- Uses existing `?adlayout=1` flow and existing layout endpoint only.
- Does not use P4 or image-set buttons.

- [ ] **Step 1: Start from the approved preview workflow**

Open the existing release preview with `?adlayout=1`. Submit the three selectable layout candidates for the six representative cases: bathroom/three benefits, solid product, lifestyle scene, long headline, 4:5 or 9:16, and 1:1. Do not press any control labelled image generation, image set, background generation, or benefit generation.

- [ ] **Step 2: Inspect editable layer evidence**

For each selected candidate confirm: product is at least 8% of canvas; headline and benefits remain present; numeric claim appears once; three benefits produce no support image; all effects and panels remain shape/text/image layers editable in Magic Layers.

- [ ] **Step 3: Append measured outcomes**

Append a dated section containing matrix median, hard-failure count, the six manual case outcomes, command results, and the exact commits. Record any existing tolerated planner fixture failure verbatim.

- [ ] **Step 4: Commit**

```bash
git add docs/AI-LAYOUT-REVIEW-2026-09-11.md
git commit -m "docs: record ad layout composition validation"
```
