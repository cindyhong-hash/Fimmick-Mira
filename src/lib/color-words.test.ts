import test from "node:test";
import assert from "node:assert/strict";
import { describeHexColor, describeHexCodesInText } from "./color-words.ts";

test("hex codes become colour words, not codes", () => {
  assert.equal(describeHexColor("#ffeb85"), "warm light yellow");
  assert.equal(describeHexColor("#3b82f6"), "vivid blue");
  // 短寫法與帶 alpha 的都要認得，否則會原樣留在提示詞裡。
  assert.equal(describeHexColor("#fff"), "off-white");
  assert.match(describeHexColor("#3b82f680") ?? "", /translucent/);
  assert.equal(describeHexColor("not-a-color"), null);
});

test("every hex in a brief is replaced, wherever it came from", () => {
  // 兩個來源：使用者選的色板（配色那行）、以及潤色模型自己在敘述裡塞的。
  // 實測潤色回來的文字含 #9ee7ff，而翻譯器原本還被要求「保留色碼」。
  const brief = [
    "主體：SALON Enzyme 身體刮毛乳液（藍色瓶身）",
    "配色：主色 #3b82f6",
    "日系清新浴室場景，搭配一抹 #9ee7ff 的冷調漸層。",
  ].join("\n");
  const out = describeHexCodesInText(brief);

  assert.doesNotMatch(out, /#[0-9a-fA-F]{3,8}\b/, "提示詞裡還有色碼，生圖模型會把它畫成文字");
  assert.match(out, /配色：主色 vivid blue/);
  assert.match(out, /一抹 light vivid blue 的冷調漸層/);
  // 只換色碼，其他內容原封不動。
  assert.match(out, /^主體：SALON Enzyme 身體刮毛乳液（藍色瓶身）$/m);
});

test("text with no hex is returned untouched", () => {
  const brief = "柔和的粉色檯面，側光，留白給文案";
  assert.equal(describeHexCodesInText(brief), brief);
});
