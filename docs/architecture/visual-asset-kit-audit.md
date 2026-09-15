# Visual Asset Kit Architecture Audit

**Verified:** 2026-09-15  
**Branch:** `codex/ad-layout-composition-plan`  
**Verified HEAD:** `d507b31`  
**Scope:** Architecture and baseline verification before implementing the Visual Asset Kit plan.

## Conclusion

The revised specification describes the current product image-set architecture accurately after applying two corrections:

1. `detail` is the current stored texture-detail role. Stored `texture` is a legacy alias.
2. The repository has no React component-test stack. UI invariants should remain in pure TypeScript helpers tested with Node's test runner and `tsx`; visual behavior should use the existing preview workflow.

The existing Product Analysis, shared `ImageSetArtDirection`, prompt compiler, paid-generation lease, Vercel Blob persistence, `LibraryImage`, asset library, Magic Layers, and ad-layout pipeline should be extended rather than replaced.

Generated assets must remain in `LibraryImage`. A separate batch metadata record is still justified because `LibraryImage.batchId` groups rows but does not persist the confirmed theme, art direction, selected plan, or aggregate kit status.

## Architecture Audit

### 1. Product image-set entry route

The product screen is:

`src/app/clients/[clientId]/products/[productId]/page.tsx`

It opens `ImageSetModal` for the selected product. The current image-set API is `src/app/api/products/[productId]/image-set/route.ts`.

### 2. Main components

- `src/components/products/ImageSetModal.tsx`: loads analysis and suggestions, selects roles, creates the batch, polls LibraryImage rows, resumes a saved batch, reports progress, and supports individual retry.
- `src/components/products/ProductGrid.tsx`: product listing and product entry behavior.
- `src/components/products/NewProductModal.tsx`: product creation and source-image entry.
- `src/app/clients/[clientId]/products/[productId]/page.tsx`: product details, role completeness, and stored product assets.

`ImageSetModal` currently owns several concerns. The kit work should extract pure state, validation, and board-model functions while preserving the component and current design system.

### 3. Product Analysis

- `src/lib/products/product-visual-analysis.ts`: vision analysis and `ImageSetArtDirection` construction.
- `src/lib/products/product-visual-profile.ts`: profile types, parsing, and source hashing.
- `src/app/api/products/[productId]/image-set/analyze/route.ts`: existing analysis endpoint.
- `src/lib/products/image-set-orchestrator.ts`: cache lookup, paid-operation lease handling, analysis execution, and persistence.

The profile is stored in `Product.visualProfileJson`; `Product.visualProfileSourceHash` determines whether it is current. Analysis is shared across the batch and must not be duplicated in a new planning route.

### 4. Asset roles and prompts

- `src/lib/products/image-set-roles.ts`: `ImageSetRole`, generation paths, and `planImageSetRoles()`.
- `src/lib/products/image-set-prompts.ts`: `compileImageSetPrompt()`.
- `src/lib/products/product-visual-analysis.ts`: `ImageSetArtDirection` and `buildImageSetArtDirection()`.

`buildImageSetArtDirection()` is called once for the batch path, and the same direction is passed to role prompts and persisted for retry. The existing prompt structure already combines shared art direction with role-specific instructions.

The current stored core roles are:

```text
hero | detail | background | benefit | decoration
```

`src/lib/productMeta.ts` defines the role labels and completeness aliases. `texture` is a legacy stored alias for current `detail`. New LibraryImage rows must store `detail`, not `texture`.

### 5. Image generation API and provider routing

- `src/app/api/products/[productId]/image-set/route.ts`: read current analysis/suggestions and create paid batch work.
- `src/app/api/products/[productId]/image-set/analyze/route.ts`: analyze or reuse the cached product profile.
- `src/app/api/products/[productId]/hero/route.ts`: product cutout flow.
- `src/lib/products/image-set-model-router.ts`: GPT/FAL image routes, Seedream/FLUX edit paths, remove-background behavior, fallback budget, and deadline control.
- `src/lib/products/image-set-orchestrator.ts`: per-row lifecycle, batch sequencing, retry, timeout, compare-and-set ownership, and cleanup.

Paid endpoints use the shared fail-closed route guard. Product and row leases prevent duplicate paid work and late results from overwriting newer ownership.

### 6. Generated asset persistence

Each generated image is one `LibraryImage` row. `imageUrl` points to persisted Vercel Blob storage through the existing storage helpers. `status`, `errorMessage`, provider trace in `paramsJson`, generation lease fields, and durable orphan-cleanup jobs support safe paid generation.

`LibraryImage.batchId` groups rows created by one generation request. It does not currently preserve a separately editable kit definition.

### 7. Database models

Relevant current Prisma models include:

- `Client`
- `Product`
- `LibraryImage`
- `ImageAssetCleanupJob`
- `Activity`
- `GeneratedLayout`
- `StyleComponent`
- Monthly planner and campaign models

There is no ProductAsset table. `Product.assets` is the relation to `LibraryImage`. Any kit implementation must keep that relation and its existing library/editor consumers.

### 8. Asset library data structure

Generated and uploaded images use `LibraryImage`. Style blocks and brand fonts use `StyleComponent`; fonts use the existing `FONT` type convention. Gallery and image APIs expose LibraryImage data rather than a separate product-asset DTO store.

Adding a second asset table would require migrations and duplicated library, editor, layout, lease, and cleanup paths. The kit should add nullable metadata to `LibraryImage` only where required and use one batch metadata record for the confirmed kit snapshot.

### 9. Free-form editor import

The existing handoff uses sessionStorage constants from `src/components/activities/RolePickerModal.tsx`:

- `ML_COMPOSE_BG_KEY`
- `ML_COMPOSE_CLIENT_KEY`
- `ML_WIZARD_SEED_KEY`

`src/components/magic-layers/ComposeView.tsx` consumes and removes those values. The kit CTA should extend this existing serializable handoff only if it cannot already carry multiple asset IDs. It must not create another editor.

### 10. AI ad-layout asset selection

`src/app/api/magic-layers/ad-layout/route.ts` currently loads every `DONE` asset belonging to the product, ordered newest first. It then passes the assets to `createAdLayoutContext()`.

`src/lib/magic-layers/ad-layout-context.ts` maps current `detail` and legacy `texture` into the same ad-layout `detail` role. This mapping should be reused.

Once one product can have multiple kits, the current product-wide query can mix themes. A kit-originated request must filter by the confirmed `batchId`, and optional asset IDs must be intersected with the same product, batch, and `DONE` status.

### 11. Existing code that should be reused

- Product visual analysis and profile cache.
- Shared art direction and prompt compiler.
- Image-set model router and fallback/time budgets.
- Product and LibraryImage lease/CAS behavior.
- Durable orphan cleanup.
- Vercel Blob storage.
- LibraryImage asset library integration.
- Product role labels and legacy aliases.
- Magic Layers sessionStorage handoff.
- Ad-layout context, role mapping, editable layer output, and feature flag.
- Existing Node/tsx pure-function testing pattern.

### 12. Required additions

- Extend `ImageSetArtDirection` with `mood` and `decorationStyle`, parsed backward-compatibly.
- Add theme input using `PROMO_FIXED` and `TAIWAN_SEASONAL` from `src/lib/calendar/tw-calendar.ts`.
- Add a free plan endpoint that reuses the existing analysis service and performs no paid image generation.
- Persist the exact confirmed theme, art direction, selected plan, and aggregate status in a ProductImageSet metadata record.
- Keep images in LibraryImage and add nullable `assetSubtype` and verified `hasTransparentBackground` fields.
- Make the asset plan variable-length while default-selecting one core asset for each of the five current roles.
- Add direction review, checklist, exact selected count, progress, and partial-completion UI.
- Add the Visual Asset Board and batch-scoped retry/read APIs.
- Scope AI ad layout and editor handoff to the selected batch.
- Add an additive Turso migration. Do not rewrite existing LibraryImage rows.

## Resume Error Reproduction

### Observed path

`ImageSetModal.loadRows()` requests the IDs saved in localStorage from:

```text
GET /api/library/images?ids=<saved row IDs>
```

The API returns only LibraryImage rows that still exist. The modal compares the saved and returned ID sets using `isCompleteImageSetResume()`. If any saved row is absent, duplicated, or has an unsupported status, `loaded.complete` is false and the modal displays:

```text
無法讀取既有套圖進度：既有套圖進度資料尚未完整，請重新讀取。
```

### Automated reproduction

`src/components/products/image-set-resume-recovery.test.ts` now reproduces the path with three saved IDs and two returned IDs. It verifies that `isCompleteImageSetResume()` returns false and that `ImageSetModal` routes the condition to resume recovery with the reported message.

### Evidence and classification

The local SQLite database contained two product image-set batches with three rows each. All six rows had valid `DONE` status and non-empty image URLs. No invalid status was found.

The reproducible failure requires the saved browser pointer to reference a row missing from the database response. This is genuine referential drift between localStorage and LibraryImage data, not a rule that incorrectly rejects a valid `FAILED` row. `FAILED` is already an accepted status, and a complete saved batch may contain both DONE and FAILED rows.

Likely triggers include deleting a LibraryImage after saving the batch, changing databases while retaining browser localStorage, or retaining a stale saved batch after data reset. The current evidence does not identify which trigger caused the original user's browser state because that localStorage payload is not present in repository data.

Task 2 should therefore preserve the strict ID check while improving recovery from a stale saved pointer. It should not pretend a missing LibraryImage is a valid generated asset.

## Baseline Verification

Commands and results on the verified branch:

```text
npx prisma generate
PASS — Prisma Client 7.8.0 generated.

npx tsc --noEmit
PASS — 0 errors.

npx next build
PASS — exit 0; all routes compiled.

npx tsx --test "src/lib/**/*.test.ts" "src/app/**/*.test.ts" "src/components/**/*.test.ts"
297 tests: 296 pass, 1 known failure.
```

The sole failure is `src/lib/planner/content-brief.test.ts`:

```text
buildPlannerActivityDraft maps a carousel brief into an editable draft
```

The actual value contains `subtitleText: null`; the fixture expectation omits that field. This is the known permitted planner/content-brief baseline failure.

## Environment Note

At audit time, `.env.local` resolved `DATABASE_URL` to `file:./prisma/dev.db`. The worktree's `node_modules` is shared with the main checkout. Do not run `npm install` for this work. Recheck the database URL immediately before creating or applying the Task 3 migration.
