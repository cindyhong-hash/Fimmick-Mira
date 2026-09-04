import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("interactive styles do not mix border shorthand with borderColor", () => {
  const source = readFileSync(
    new URL("./MagicLayersEditor.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /borderColor\s*:/);
});
