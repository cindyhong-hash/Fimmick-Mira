import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { analyzePreparedBackground, scoreBackgroundRect } from "./ad-layout-background-analysis.ts";

test("marks a uniform prepared background as safe and a high-edge checkerboard as panel-worthy", async () => {
  const uniform = await sharp({ create: { width: 120, height: 120, channels: 3, background: "#f7f7f7" } }).png().toBuffer();
  const checker = await sharp({ create: { width: 120, height: 120, channels: 3, background: "#111111" } })
    .composite(Array.from({ length: 36 }, (_, index) => ({ input: { create: { width: 20, height: 20, channels: 3, background: index % 2 ? "#ffffff" : "#111111" } }, left: (index % 6) * 20, top: Math.floor(index / 6) * 20 })))
    .png().toBuffer();
  const rect = { x: 0.1, y: 0.1, w: 0.6, h: 0.4 };
  assert.equal(scoreBackgroundRect(await analyzePreparedBackground(uniform), rect).safeForCopy, true);
  assert.equal(scoreBackgroundRect(await analyzePreparedBackground(checker), rect).needsPanel, true);
});
