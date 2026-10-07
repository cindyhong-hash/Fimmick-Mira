import assert from "node:assert/strict";
import test from "node:test";

import { MAX_TEXT_BLOCKS, buildTextEditPrompt, collectTextEdits, parseImageTextBlocks } from "./image-text-edit.ts";

test("parseImageTextBlocks reads a JSON array wrapped in a code fence", () => {
  assert.deepEqual(parseImageTextBlocks('```json\n["舒適促銷只要699", "限時優惠，極致呵護"]\n```'), ["舒適促銷只要699", "限時優惠，極致呵護"]);
});

test("parseImageTextBlocks accepts {text} objects and drops blanks and duplicates", () => {
  assert.deepEqual(parseImageTextBlocks('[{"text":"A 標題"},{"text":" "},{"text":"A 標題"},"副標"]'), ["A 標題", "副標"]);
});

test("parseImageTextBlocks falls back to one block per line, stripping list markers", () => {
  assert.deepEqual(parseImageTextBlocks("1. 精緻也可以很便宜\n- 限時優惠\n\n「立即搶購」"), ["精緻也可以很便宜", "限時優惠", "立即搶購"]);
});

test("parseImageTextBlocks returns nothing for empty output and caps the list", () => {
  assert.deepEqual(parseImageTextBlocks(null), []);
  assert.deepEqual(parseImageTextBlocks("[]"), []);
  const many = JSON.stringify(Array.from({ length: 30 }, (_, i) => `字${i}`));
  assert.equal(parseImageTextBlocks(many).length, MAX_TEXT_BLOCKS);
});

test("collectTextEdits keeps only changed blocks and treats cleared ones as removals", () => {
  assert.deepEqual(
    collectTextEdits(["只要699", "限時優惠", "立即搶購"], ["只要599", "限時優惠", "  "]),
    [{ from: "只要699", to: "只要599" }, { from: "立即搶購", to: "" }],
  );
});

test("buildTextEditPrompt spells out the new text and lists removals", () => {
  const p = buildTextEditPrompt([{ from: "只要699", to: "只要599" }, { from: "立即搶購", to: "" }]);
  assert.match(p, /Replace the text "只要699" with EXACTLY "只要599"/);
  assert.match(p, /"5" "9" "9"/);
  assert.match(p, /REMOVE the text "立即搶購"/);
});
