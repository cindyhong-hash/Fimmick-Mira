import assert from "node:assert/strict";
import test from "node:test";
import { addPreset, animsForTargets, copyableAnims, MAX_PRESETS, parsePresets, readingOrder, type AnimPreset } from "./anim-presets.ts";
import { defaultAnim, type LayerAnim } from "./layer-animation.ts";

const pop = { ...defaultAnim("popIn", "a1", 0.3), label: "主標" };
const shine = { ...defaultAnim("shine", "a2", 1.2), direction: "downRight" as const };
const carousel: LayerAnim = { ...defaultAnim("carousel", "a3", 0), group: "carousel_x", anchorX: 540, steps: 3 };

test("複製動畫：輪播不複製、id 和自己取的名字拿掉，其他設定照抄", () => {
  const c = copyableAnims([pop, shine, carousel]);
  assert.deepEqual(c.map((a) => a.kind), ["popIn", "shine"]);
  assert.equal(c[0].label, undefined);
  assert.equal(c[0].start, 0.3);
  assert.equal(c[1].direction, "downRight");
  assert.equal(copyableAnims(undefined).length, 0);
});

test("貼給好幾個物件：每個都是新的 id；錯開時第 i 個晚 i×step 秒", () => {
  let n = 0;
  const out = animsForTargets(copyableAnims([pop, shine]), 3, 0.3, () => `n${++n}`);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((as) => as[0].start), [0.3, 0.6, 0.9]);
  assert.deepEqual(out.map((as) => as[1].start), [1.2, 1.5, 1.8]);
  assert.equal(new Set(out.flat().map((a) => a.id)).size, 6);
  // 不錯開：全部一樣的開始時間
  assert.deepEqual(animsForTargets(copyableAnims([pop]), 2, 0, () => "x").map((as) => as[0].start), [0.3, 0.3]);
});

test("閱讀順序：由上到下，同一列由左到右", () => {
  const order = readingOrder([
    { cx: 800, cy: 105, h: 100 },   // 第一列右邊
    { cx: 200, cy: 400, h: 100 },   // 第二列
    { cx: 100, cy: 100, h: 100 },   // 第一列左邊（跟右邊那個差不到半個高度，算同一列）
  ]);
  assert.deepEqual(order, [2, 0, 1]);
});

test("公版：存取、同名取代、超過上限擠掉最舊的、壞資料丟掉", () => {
  const p = (name: string, i: number): AnimPreset => ({ id: `p${i}`, name, anims: [{ ...pop, id: `x${i}` }], createdAt: i });
  let list: AnimPreset[] = [];
  list = addPreset(list, p("主標彈出", 1));
  list = addPreset(list, p("價格閃光", 2));
  list = addPreset(list, p("主標彈出", 3));
  assert.deepEqual(list.map((x) => [x.name, x.id]), [["主標彈出", "p3"], ["價格閃光", "p2"]]);
  for (let i = 0; i < MAX_PRESETS + 5; i++) list = addPreset(list, p(`公版 ${i}`, 10 + i));
  assert.equal(list.length, MAX_PRESETS);
  // 讀回來：格式對的留下，壞的丟掉
  const back = parsePresets(JSON.stringify([...list.slice(0, 2), { id: 1 }, { id: "z", name: "空的", anims: [] }, "x"]));
  assert.equal(back.length, 2);
  assert.equal(back[0].anims[0].kind, "popIn");
  assert.deepEqual(parsePresets("不是 JSON"), []);
  assert.deepEqual(parsePresets(null), []);
});
