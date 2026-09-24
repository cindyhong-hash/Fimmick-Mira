import assert from "node:assert/strict";
import test from "node:test";
import { keepAssetType, parseAssetTypeReply, readAssetType, withAssetType } from "./asset-type.ts";

test("讀寫分類：其他欄位原樣保留", () => {
  const p = withAssetType(JSON.stringify({ genType: "scene", mode: "flux-scene" }), "illustration", "ai");
  assert.deepEqual(JSON.parse(p), { genType: "scene", mode: "flux-scene", assetType: "illustration", assetTypeSource: "ai" });
  assert.deepEqual(readAssetType(p), { type: "illustration", source: "ai" });
  assert.equal(readAssetType(JSON.stringify({ genType: "scene" })), null);   // 舊素材沒有分類
  assert.equal(readAssetType("壞掉"), null);
  assert.equal(readAssetType(JSON.stringify({ assetType: "亂填" })), null);
});

test("paramsJson 整份覆寫時保留分類；新內容自己帶分類就用新的", () => {
  const old = withAssetType("{}", "person", "user");
  assert.deepEqual(readAssetType(keepAssetType(old, JSON.stringify({ genType: "person" }))), { type: "person", source: "user" });
  assert.deepEqual(readAssetType(keepAssetType(old, withAssetType("{}", "product", "ai"))), { type: "product", source: "ai" });
  assert.equal(keepAssetType("{}", "{\"a\":1}"), "{\"a\":1}");
});

test("解析看圖 AI 的回覆：JSON、中文標籤、同義字；看不懂回 null", () => {
  assert.equal(parseAssetTypeReply('{"type":"background"}'), "material");
  assert.equal(parseAssetTypeReply('```json\n{"type":"illustration"}\n```'), "illustration");
  assert.equal(parseAssetTypeReply('{"category":"人像"}'), "person");
  assert.equal(parseAssetTypeReply("product"), "product");
  assert.equal(parseAssetTypeReply('{"type":"reference"}'), "uploaded");
  assert.equal(parseAssetTypeReply('{"type":"unknown"}'), null);
  assert.equal(parseAssetTypeReply("I think it's a cat"), null);
});
