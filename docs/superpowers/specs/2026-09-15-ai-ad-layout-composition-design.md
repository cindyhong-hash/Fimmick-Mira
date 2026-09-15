# AI Ad Layout Composition Design

**Status:** proposed for review  
**Scope:** the existing "AI 幫我排版" candidate generator and its editable Magic Layers output. This design does not generate images and does not change the editor UI.

## Problem

The system creates technically valid editable layer sets, but the three candidates can still look assembled rather than art-directed. The reviewed bathroom examples show the recurring failures: a scene-led product is too small or floats beside its apparent supporting surface; a large blank region has no intentional role; benefits compete with the product or lack contrast; a secondary image competes with the product despite three typed benefits; and a numeric benefit is rendered twice.

Preview and editor do use the same geometry: the modal draws the same `LayerData` later saved to session storage and opened in Magic Layers. The fault is the composition contract that creates those layers. Scene-led templates start with narrow, low hero zones, polish can only grow by a small fixed amount, and the renderer always places benefits in a fixed bottom row. Product, copy, benefits, background safety, and support imagery therefore claim space independently.

## Outcomes

Each existing candidate becomes a deliberate, editable composition with stable hierarchy:

1. Product is the visual primary in every candidate.
2. Headline, benefit group, and support imagery have defined roles and reserved space.
3. Background texture and scene evidence influence safe placement without allowing an LLM to create arbitrary coordinates.
4. A candidate that violates core constraints is deterministically reflowed before it reaches the UI.
5. Every output remains ordinary editable Magic Layers; no canvas or editor redesign occurs.

Scene-led output targets a median product area of at least 10% of its canvas, and no accepted candidate may fall below 8%. Product footprint is evaluated from both area and aspect ratio, so tall bottles are never incorrectly forced into wide geometry.

## Design principles

- **Bounded AI judgment.** Vision describes the prepared background and art direction selects named variants. Neither returns free-form product, text, or icon coordinates.
- **User intent survives.** User-entered headline and benefits always render. Art direction controls presentation, never whether input disappears.
- **Reserve before render.** Product, copy, and benefits receive non-overlapping regions in a composition plan before layers are emitted.
- **Remove before decorate.** With three typed benefits, support imagery is suppressed unless an explicit variant requires it and it remains subordinate to product.
- **Fail deterministically.** Evaluation may choose a bounded alternate template or at most two reflows. It never makes another AI request, chooses random positions, or ships failed hierarchy.
- **No paid generation.** P4 image generation is neither called nor tested in this work.

## Composition contract

`AdLayoutDesignSpec` gains a `CompositionPlan`, produced before the renderer creates `LayerData`. It is the one layout contract shared by composition, product integration, benefit rendering, quality checks, and polish.

```ts
type CompositionStrategy = "product-hero" | "split-layout" | "scene-integrated";
type NormalizedRect = { x: number; y: number; w: number; h: number };

type CompositionPlan = {
  strategy: CompositionStrategy;
  variant: string;
  productZone: NormalizedRect;
  copyZone: NormalizedRect;
  benefitZone?: NormalizedRect;
  supportZone?: NormalizedRect;
  primary: "product";
  secondary: "headline" | "benefits";
  tertiary?: "benefits" | "support";
  alignment: "left" | "center" | "right";
  productPlacement: "floating" | "surface-aligned";
};
```

| Existing direction | Strategy | Primary intent |
| --- | --- | --- |
| product-focus | `product-hero` | Product dominates; copy and benefits support it. |
| editorial | `split-layout` | A deliberate product/copy partition creates the second field. |
| scene-led | `scene-integrated` | Product belongs to the scene plane while remaining visually dominant. |

Art direction may select a named variant within its strategy. It cannot choose another primary, remove benefits, or shrink the product below scorecard thresholds.

## Geometry pipeline

1. Build inventory from the newest completed asset for each role. `Product.heroImageUrl` remains an explicit hero override only when current product data intentionally supplies it.
2. Prepare background at final canvas ratio. The existing final-canvas crop before vision remains mandatory because normalized scene data must match rendered output.
3. Resolve strategy and variant from purpose, ratio, assets, and bounded art direction.
4. Construct `CompositionPlan` from normalized template zones. Scene-led variants receive directly corrected, substantially larger product zones; this is not delegated to an 8% polish increase.
5. Apply optional grounding only with trusted `surfaceRect`. It can align product bottom to the surface and cap width to a safe portion. If it would reduce product below half its planned area or below minimum footprint, retain planned floating geometry.
6. Reserve a benefit band before fitting product. The band is normally 12–15% of canvas height and has its own copy-safe rectangle. Product moves upward before it is shrunk.
7. Fit product by aspect-preserving area and footprint rules. It is never stretched to fill a zone.
8. Build layers, evaluate, and make at most two deterministic repairs: choose a safer slot, enlarge to attainable threshold, switch to a bounded alternate variant, add a readable benefit panel, or remove optional support imagery.

Repairs cannot add image assets, make provider requests, or alter user text.

## Background evidence and safe regions

A deterministic background analyser receives the already prepared final-canvas image buffer. It divides the image into a fixed normalized grid and scores cells for luminance, local contrast, texture/edge density, and dominant-color stability. Proposed copy and benefit rectangles are scored from the cells they cover.

This does not replace existing vision assessment:

- `textSafeArea` remains a high-level preferred copy hint.
- `placementSurface` controls product grounding treatment such as shadows.
- Validated `surfaceRect` remains optional evidence for a precise product baseline.
- Deterministic grid scores decide whether a proposed group is readable enough or needs an editable panel.

A hard vertical background split cannot become an accidental second column. A large empty field is allowed only when the plan assigns it to copy, benefits, or intentional negative space while the product still meets its footprint threshold.

## Product integration

Existing editable cast shadow, contact shadow, reflection/highlight, and color layers remain. They consume the final product rectangle from the plan, so integration effects cannot make an undersized or ungrounded product look accepted.

When a trusted surface rectangle permits alignment, contact shadow follows the aligned baseline. `sceneGrounding` and `surfaceRect` remain separate facts: a scene can receive surface-style integration without a valid rectangle, but only a valid rectangle can move product geometry.

## Copy, benefit groups, and asset budget

Headline and benefits are sibling groups in the plan, not independent renderer defaults.

- Headline fits within `copyZone`, using its prescribed alignment and safe-region score.
- Benefits render only in `benefitZone` with shared icon, value, and description baselines.
- A numeric claim splits once: `48 小時保濕` becomes value `48 小時` and description `保濕`. A value without a remaining description renders only once.
- If a band fails contrast, renderer emits an editable subtle panel behind the whole group rather than scattering items.
- Icon selection remains deterministic and scoped to the relevant phrase. Mapping adds skincare language: `溫和`, `親膚`, `觸感`, `柔嫩`, `舒緩`, and `修護`.

With three user-entered benefits, optional support imagery is off by default. It may appear only in a named variant that explicitly requires it, has a safe support zone, uses one image at most, and scores smaller and less prominent than product. Otherwise it is removed.

## Candidate evaluation and repair

A deterministic scorecard evaluates final pixel rectangles and prepared-background measurements:

| Dimension | Requirement |
| --- | --- |
| hierarchy | Product is largest visual object and primary role. |
| footprint | Product is at least 8%; scene-led median reaches 10% across the matrix. |
| grouping | Headline and benefits each form a coherent aligned group. |
| alignment | Related layers share the planned axis or baseline. |
| whitespace | Large regions have an assigned compositional purpose. |
| contrast | Copy and benefits pass background score or receive a panel. |
| boundaries | Visible copy and product remain inside canvas. |
| collision | No copy/product intersection or unintentional overlap. |
| asset budget | No competing support image when three typed benefits carry the message. |

Hard failures are product below 8%, copy outside safe zone, copy/product overlap, unassigned product/background division, or competing support imagery with three benefits. They trigger bounded repair. If a variant cannot pass after two repairs, it is replaced with a valid fallback in the same strategy. UI still receives three candidates, sorted by score, retaining current selection flow.

## Art-direction schema cleanup

`graphics` remains in the art-direction response but has no consumer after user benefits were correctly made unconditional. First, `parseArtDirection` accepts objects with unknown keys and retains only supported fields. This prevents stale model output invalidating an entire decision. Then `graphics` is removed from prompt and internal decision type. The migration is parser-first and backward tolerant.

## Background-generation prompt follow-up

This work never calls P4. It prepares a separately testable background-role prompt revision for future use: a product-free coherent scene plate, contiguous copy-safe region, clear product placement plane, no hard split-screen, dominant mirror/sink, or competing prop, and quiet space around product zone. Prompt tests assert wording only and never call an image provider.

## File responsibilities

| File | Responsibility |
| --- | --- |
| `src/lib/magic-layers/ad-layout-composition-plan.ts` | Strategy-to-plan resolution, variants, normalized zones, bounded reflow inputs. |
| `src/lib/magic-layers/ad-layout-background-analysis.ts` | Final-canvas grid analysis and rectangle readability scores. |
| `src/lib/magic-layers/ad-layout-scoring.ts` | Hierarchy/footprint/grouping/contrast evaluation and repair decision. |
| `src/lib/magic-layers/ad-layout-composition.ts` | Apply plan, aspect fitting, and safe surface alignment. |
| `src/lib/magic-layers/ad-layout-templates.ts` | Corrected scene-led zones and named bounded variants. |
| `src/lib/magic-layers/ad-layout-design-spec.ts` | Persist `CompositionPlan` in candidate specification. |
| `src/lib/magic-layers/ad-layout-renderer.ts` | Render planned copy/benefit groups, panel, and support budget. |
| `src/lib/magic-layers/ad-layout-quality.ts` | Integrate final geometry checks with scorecard. |
| `src/lib/magic-layers/ad-layout-polish.ts` | Apply score-directed repair rather than fixed-size growth alone. |
| `src/lib/magic-layers/ad-layout-art-direction.ts` | Backward-tolerant parsing, then removal of unused `graphics`. |
| `src/lib/magic-layers/image-set-roles.ts` | Future background-plate prompt wording only. |

Tests live beside the modules they exercise. A matrix evaluation helper may live under `src/lib/magic-layers` or `scripts`, but automated runs use fixture assets and deterministic analysis.

## Verification and acceptance

Automated verification covers bathroom with three benefits, solid-color product layout, lifestyle scene, long headline, 4:5 and 9:16 output, and 1:1 output. It verifies strategy mapping, product minima, surface fallback, benefit grouping, numeric deduplication, contrast-panel insertion, support suppression, parser compatibility, and unchanged editable layer serialization.

Every geometry change runs the 72-case matrix: `2 products × 3 ratios × 4 purposes × 3 directions`. It reports product-area distribution, hard failures, copy bounds, copy/product collisions, benefit count, numeric duplication, and support-image budget. It generates a local before/after contact sheet from fixture or already-existing local assets; this is a layout artifact, not an image-generation request.

Before completion run:

```bash
npx tsc --noEmit
npx next build
npx tsx --test "src/lib/**/*.test.ts" "src/app/**/*.test.ts"
```

The known planner `content-brief` `subtitleText` fixture failure remains the only tolerated suite failure. ESLint runs only for changed layout files and may add no errors to the repository baseline. A final manual pass may call the existing layout endpoint for the three candidates but must not click P4 or any image-generation action.

## Non-goals and rollout

This phase does not redesign the modal or editor, replace editable layer data, turn on `SHOW_AD_LAYOUT`, change feature-flag defaults, or create background or benefit images. It does not trust raw AI coordinates or add random decorations to hide composition failures.

The feature remains behind its current flag. First validate fixtures and the 72-case matrix, then run a limited manual layout pass. Production rollout is a separate approval after visual evidence shows matrix and selected real examples meet acceptance criteria.
