import assert from "node:assert/strict";
import test from "node:test";
import { frameCount, videoSize } from "./mp4-export.ts";

test("影片尺寸：長邊最多 maxSide、兩邊偶數、比例不變", () => {
  assert.deepEqual(videoSize(1200, 1200), { width: 1200, height: 1200 });
  assert.deepEqual(videoSize(1125, 2000), { width: 900, height: 1600 });
  assert.deepEqual(videoSize(1201, 999, 4000), { width: 1202, height: 1000 });
  const s = videoSize(1200, 1600);
  assert.equal(s.width % 2, 0); assert.equal(s.height % 2, 0);
});

test("格數", () => {
  assert.equal(frameCount(6, 30), 180);
  assert.equal(frameCount(0, 30), 1);
});
