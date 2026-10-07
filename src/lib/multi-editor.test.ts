import assert from "node:assert/strict";
import test from "node:test";

import { buildRegenerateCellPrompt, moveItem, parseMultiLayoutMeta } from "./multi-editor.ts";

test("parseMultiLayoutMeta survives empty or broken JSON", () => {
  assert.deepEqual(parseMultiLayoutMeta(undefined), {});
  assert.deepEqual(parseMultiLayoutMeta("{}"), {});
  assert.deepEqual(parseMultiLayoutMeta("not json"), {});
  assert.deepEqual(parseMultiLayoutMeta("[1,2]"), {});
});

test("parseMultiLayoutMeta keeps valid collage style and logos, drops junk", () => {
  const meta = parseMultiLayoutMeta(JSON.stringify({
    collage: { accentColor: "#AABBCC", fullBleed: true },
    compositeLogos: [
      { logoUrl: "/uploads/logo.png", x: 0.1, y: 0.2, scale: 1.5, shadow: true },
      { logoUrl: "/uploads/bad.png", x: "0.1", y: 0.2 },
      null,
      { logoUrl: "data:image/png;base64,AAA", x: 0.9, y: 0.9 },
    ],
  }));
  assert.deepEqual(meta, {
    collage: { accentColor: "#AABBCC", fullBleed: true },
    compositeLogos: [
      { logoUrl: "/uploads/logo.png", x: 0.1, y: 0.2, scale: 1.5, shadow: true },
      { logoUrl: "data:image/png;base64,AAA", x: 0.9, y: 0.9 },
    ],
  });
});

test("parseMultiLayoutMeta ignores a malformed accent color", () => {
  assert.deepEqual(parseMultiLayoutMeta(JSON.stringify({ collage: { accentColor: "red" } })), { collage: {} });
});

test("moveItem moves forward and backward and ignores bad indexes", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 3, 0), ["d", "a", "b", "c"]);
  const same = ["a", "b"];
  assert.equal(moveItem(same, 1, 1), same);
  assert.equal(moveItem(same, 0, 5), same);
});

test("buildRegenerateCellPrompt locks known texts and includes the user's wish", () => {
  const p = buildRegenerateCellPrompt({ texts: ["只要599", " "], instruction: "換成浴室場景" });
  assert.match(p, /• "只要599"/);
  assert.doesNotMatch(p, /• " "/);
  assert.match(p, /THE USER WANTS: 換成浴室場景/);
});

test("buildRegenerateCellPrompt falls back to copying IMAGE 1's text", () => {
  const p = buildRegenerateCellPrompt({});
  assert.match(p, /same text content as IMAGE 1/);
  assert.doesNotMatch(p, /THE USER WANTS/);
});
