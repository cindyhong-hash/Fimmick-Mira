import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReplacePrompt, clampAspect, coverCrop, generationSize, nearestEditRatio } from "./replace-image.ts";

test("clampAspect keeps frames between 1:3 and 3:1 and survives bad input", () => {
  assert.equal(clampAspect(10), 3);
  assert.equal(clampAspect(0.05), 1 / 3);
  assert.equal(clampAspect(NaN), 1);
  assert.equal(clampAspect(-2), 1);
  assert.equal(clampAspect(1.5), 1.5);
});

test("generationSize: long side 1280, multiples of 16, close to the frame ratio", () => {
  for (const a of [1, 1.5, 0.75, 16 / 9, 9 / 16, 2.9]) {
    const { width, height } = generationSize(a);
    assert.equal(Math.max(width, height), 1280);
    assert.equal(width % 16, 0);
    assert.equal(height % 16, 0);
    assert.ok(Math.abs(width / height - a) / a < 0.02, `ratio ${a}`);
  }
});

test("nearestEditRatio picks the closest supported ratio", () => {
  assert.equal(nearestEditRatio(1), "1:1");
  assert.equal(nearestEditRatio(1.5), "3:2");
  assert.equal(nearestEditRatio(0.92), "1:1");
  assert.equal(nearestEditRatio(0.8), "4:5");
  assert.equal(nearestEditRatio(0.55), "9:16");
  assert.equal(nearestEditRatio(2.5), "21:9");
});

test("coverCrop centres the crop and matches the target ratio", () => {
  assert.deepEqual(coverCrop(1024, 768, 1), { left: 128, top: 0, width: 768, height: 768 });
  assert.deepEqual(coverCrop(1000, 1000, 2), { left: 0, top: 250, width: 1000, height: 500 });
  const c = coverCrop(1024, 1024, 0.6);
  assert.ok(Math.abs(c.width / c.height - 0.6) < 0.01);
});

test("prompts: edit keeps the rest, cutout asks for a plain background, never text", () => {
  const e = buildReplacePrompt("edit", "換成短髮", false);
  assert.match(e, /"換成短髮"/);
  assert.match(e, /clearly visible/);
  assert.match(e, /anything they are holding/);
  assert.match(e, /No text/);
  const n = buildReplacePrompt("new", "a toothpaste tube", true);
  assert.match(n, /plain seamless white background/);
  assert.doesNotMatch(n, /Edit this image/);
});

test("edit prompt puts the detailed instruction first and keeps the user's words", () => {
  const p = buildReplacePrompt("edit", "妝容再淡一點", false, "Make the lipstick a soft nude and halve the blush.");
  assert.match(p, /^Edit this image\. Make the lipstick a soft nude/);
  assert.match(p, /"妝容再淡一點"/);
});
