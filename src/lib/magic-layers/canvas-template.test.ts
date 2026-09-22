import test from "node:test";
import assert from "node:assert/strict";
import { parseCanvasTemplatePayload, rowToCanvasTemplate } from "./canvas-template.ts";

const layer = { id: "t1", name: "標題", type: "independent_text", zIndex: 0, x: 100, y: 200, w: 800, h: 160, rotation: 0, visible: true, opacity: 1, locked: false, isText: true, text: "限時優惠" };

test("正常的範本內容過得了", () => {
  const p = parseCanvasTemplatePayload({ docW: 1200, docH: 1200, layers: [layer] });
  assert.equal(p.docW, 1200);
  assert.equal(p.layers.length, 1);
});

test("擋掉會讓編輯器爆掉的內容", () => {
  // 空白畫布存成範本沒有意義，套用後畫面全空還以為壞了
  assert.throws(() => parseCanvasTemplatePayload({ docW: 1200, docH: 1200, layers: [] }), /空白畫布/);
  assert.throws(() => parseCanvasTemplatePayload({ docW: 0, docH: 1200, layers: [layer] }), /尺寸/);
  assert.throws(() => parseCanvasTemplatePayload({ docW: 1200, docH: 1200, layers: [{ id: "x" }] }), /圖層資料/);
  assert.throws(() => parseCanvasTemplatePayload("nope"), /格式/);
});

test("目前只收 1:1", () => {
  // 先只做正方形；放寬之前套用到別的比例要先決定是換畫布還是縮放
  assert.throws(() => parseCanvasTemplatePayload({ docW: 1200, docH: 1500, layers: [layer] }), /1:1/);
});

test("壞掉的資料列回 null，不要讓整包列表失敗", () => {
  const good = rowToCanvasTemplate({ id: "a", name: "母親節", data: JSON.stringify({ docW: 1200, docH: 1200, layers: [layer] }), previewUrl: "/x.png", createdAt: new Date("2026-09-22") });
  assert.equal(good?.name, "母親節");
  assert.equal(good?.layers.length, 1);
  assert.equal(rowToCanvasTemplate({ id: "b", name: "壞的", data: "{not json", previewUrl: null, createdAt: new Date() }), null);
  assert.equal(rowToCanvasTemplate({ id: "c", name: "空的", data: JSON.stringify({ docW: 1200, docH: 1200, layers: [] }), previewUrl: null, createdAt: new Date() }), null);
});

test("沒有名字時給得出後備名稱", () => {
  const t = rowToCanvasTemplate({ id: "d", name: "", data: JSON.stringify({ docW: 1200, docH: 1200, layers: [layer] }), previewUrl: null, createdAt: new Date() });
  assert.equal(t?.name, "未命名範本");
});
