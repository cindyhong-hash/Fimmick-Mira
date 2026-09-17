import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("free image-set planning persists a DRAFT without invoking paid generation", async () => {
  const source = await readFile(new URL("./products/[productId]/image-set/plan/route.ts", import.meta.url), "utf8");

  assert.match(source, /export function GET/);
  assert.match(source, /imageSetThemeCatalog/);
  assert.match(source, /db\.product\.findUnique/);
  assert.match(source, /planProductImageSet/);
  assert.match(source, /db\.productImageSet\.create/);
  assert.doesNotMatch(source, /protectPaidRoute|runImageSetBatch|generateImageSetRole|claimProductPaidOperationLease/);
});

test("paid image-set generation consumes and confirms a persisted DRAFT", async () => {
  const source = await readFile(new URL("./products/[productId]/image-set/route.ts", import.meta.url), "utf8");

  assert.match(source, /protectPaidRoute/);
  assert.match(source, /confirmAndScheduleProductImageSet/);
  assert.match(source, /productImageSet\.findFirst/);
  assert.match(source, /status: "DRAFT"/);
  assert.match(source, /status: "CONFIRMED"/);
  assert.match(source, /status: "GENERATING"/);
  assert.match(source, /selectedItemIds/);
  assert.match(source, /planJson: data\.planJson/);
  assert.doesNotMatch(source, /selectedRoles|requestSourceHash/);
});

test("kit reader scopes metadata and assets to the requested product and batch", async () => {
  const source = await readFile(new URL("./products/[productId]/image-set/[batchId]/route.ts", import.meta.url), "utf8");

  assert.match(source, /productImageSet\.findFirst\(\{ where: \{ id: batchId, productId, product: \{ clientId \} \} \}\)/);
  assert.match(source, /libraryImage\.findMany/);
  assert.match(source, /where: \{ productId, batchId \}/);
  assert.match(source, /normalizeImageSetKitAssets/);
});

test("kit deletion verifies ownership, rejects active work, removes rows transactionally, and cleans stored assets", async () => {
  const source = await readFile(new URL("./products/[productId]/image-set/[batchId]/route.ts", import.meta.url), "utf8");

  assert.match(source, /export async function DELETE/);
  assert.match(source, /productImageSet\.findFirst\(\{ where: \{ id: batchId, productId, product: \{ clientId \} \} \}\)/);
  assert.match(source, /status === "PENDING" \|\| status === "GENERATING"/);
  assert.match(source, /db\.\$transaction/);
  assert.match(source, /libraryImage\.deleteMany\(\{ where: \{ productId, batchId \} \}\)/);
  assert.match(source, /productImageSet\.deleteMany/);
  assert.match(source, /deleteStoredAsset/);
});

test("kit history lists only confirmed sets owned by the requested client and product", async () => {
  const source = await readFile(new URL("./products/[productId]/image-sets/route.ts", import.meta.url), "utf8");

  assert.match(source, /productImageSet\.findMany/);
  assert.match(source, /productId, confirmedAt: \{ not: null \}, product: \{ clientId \}/);
  assert.match(source, /orderBy: \{ createdAt: "desc" \}/);
  assert.match(source, /libraryImage\.findMany/);
  assert.match(source, /buildVisualAssetKitHistory/);
});

test("kit retry rejects metadata changes and rebuilds from the persisted kit snapshot", async () => {
  const source = await readFile(new URL("./products/[productId]/image-set/[batchId]/assets/[assetId]/retry/route.ts", import.meta.url), "utf8");

  assert.match(source, /protectPaidRoute/);
  assert.match(source, /where: \{ id: assetId, productId, batchId \}/);
  assert.match(source, /prepareKitAssetRegenerationFromRecords\(target, kit\)/);
  assert.match(source, /body\.assetRole !== target\.assetRole/);
  assert.match(source, /body\.assetSubtype !== target\.assetSubtype/);
  assert.doesNotMatch(source, /analyzeProductVisualProfile|buildImageSetArtDirection/);
});
