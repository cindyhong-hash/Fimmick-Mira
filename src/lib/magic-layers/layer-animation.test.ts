import assert from "node:assert/strict";
import test from "node:test";
import { animEnd, animFrame, animUnits, animPhase, carouselLayout, carouselPose, carouselSlot, carouselSteps, defaultAnim, readAnims, shineBand, speedOf, SPEED_PRESETS, staggeredStarts, typeChar, videoDuration } from "./layer-animation.ts";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("animPhase：開始前、空檔、跑完都是 null；循環照 duration＋gap 算", () => {
  const a = { ...defaultAnim("shine", "a", 1), duration: 1, gap: 1, repeat: 2 };
  assert.equal(animPhase(a, 0.5), null);
  near(animPhase(a, 1.5)!, 0.5);
  assert.equal(animPhase(a, 2.5), null);       // 空檔
  near(animPhase(a, 3.25)!, 0.25);              // 第二輪
  assert.equal(animPhase(a, 5), null);          // 兩輪跑完
  assert.equal(animEnd(a), 4);
  const loop = { ...a, repeat: 0 };
  near(animPhase(loop, 9.5)!, 0.5);
  assert.equal(animEnd(loop), Infinity);
});

test("淡入：開始前透明、結束後保持顯示", () => {
  const f = defaultAnim("fadeIn", "f", 1);
  assert.equal(animFrame([f], 0).opacity, 0);
  assert.equal(animFrame([f], 5).opacity, 1);
  assert.ok(animFrame([f], 1.4).opacity > 0 && animFrame([f], 1.4).opacity < 1);
});

test("各種效果：沒動畫時不變；呼吸放大、彈跳、漂浮、閃爍、閃光", () => {
  assert.deepEqual(animFrame(undefined, 3), { dx: 0, dy: 0, scale: 1, opacity: 1, rot: 0, blur: 0, shines: [] });
  const pulse = { ...defaultAnim("pulse", "p"), duration: 2, intensity: 1 };
  near(animFrame([pulse], 0).scale, 1);
  near(animFrame([pulse], 1).scale, 1.12);      // 半輪最大
  const bounce = { ...defaultAnim("bounce", "b"), duration: 1, intensity: 1 };
  assert.ok(animFrame([bounce], 0.5).dy < 0);   // 往上
  const float = { ...defaultAnim("float", "fl"), duration: 4, intensity: 1 };
  near(animFrame([float], 1).dy, 0.05);
  const tw = { ...defaultAnim("twinkle", "t"), duration: 2, intensity: 1 };
  near(animFrame([tw], 1).opacity, 0.15);
  const sh = { ...defaultAnim("shine", "s"), duration: 1, gap: 0 };
  assert.equal(animFrame([sh], 0.5).shines.length, 1);
  // 同一個圖層疊兩個效果：縮放相乘
  near(animFrame([pulse, { ...pulse, id: "p2" }], 1).scale, 1.12 * 1.12);
});

test("光帶：從完全在外面走到完全在外面", () => {
  const start = shineBand(100, 200, { progress: 0, direction: "down", width: 0.3 });
  const end = shineBand(100, 200, { progress: 1, direction: "down", width: 0.3 });
  assert.ok(start.y1 <= -100 + 1e-9);   // 光帶在上緣外面
  assert.ok(end.y0 >= 100 - 1e-9);      // 光帶在下緣外面
  near(start.x0, 0);
  const right = shineBand(100, 200, { progress: 0.5, direction: "right", width: 0.3 });
  near((right.x0 + right.x1) / 2, 0);
  // 往上、往左：起點在下緣／右緣外面
  const up = shineBand(100, 200, { progress: 0, direction: "up", width: 0.3 });
  assert.ok(up.y1 >= 100 - 1e-9 && up.y0 > up.y1);
  const left = shineBand(100, 200, { progress: 0, direction: "left", width: 0.3 });
  assert.ok(left.x1 >= 50 - 1e-9 && left.x0 > left.x1);
  // 斜的：↗ 從左下往右上
  const ur = shineBand(100, 100, { progress: 0, direction: "upRight", width: 0.3 });
  assert.ok(ur.x0 < 0 && ur.y0 > 0 && ur.x1 > ur.x0 && ur.y1 < ur.y0);
});

test("錯開開始時間、影片長度、讀存檔", () => {
  assert.deepEqual(staggeredStarts(3, 0.5, 0.7), [0.5, 1.2, 1.9]);
  assert.equal(videoDuration([], null), 6);
  assert.equal(videoDuration([{ ...defaultAnim("fadeIn", "x", 8) }], null), 8.8);
  assert.equal(videoDuration([], 10), 10);
  assert.equal(videoDuration([], 99), 30);
  assert.equal(readAnims("nope"), undefined);
  const r = readAnims([{ kind: "shine", start: -5, intensity: 3, direction: "sideways" }, { kind: "bogus" }, { kind: "shine", direction: "diagonal" }, { kind: "shine", direction: "upLeft" }])!;
  assert.equal(r.length, 3);
  assert.equal(r[0].start, 0);
  assert.equal(r[0].intensity, 1);
  assert.equal(r[0].direction, "down");
  assert.equal(r[1].direction, "downRight");   // 舊存檔的「斜的」
  assert.equal(r[2].direction, "upLeft");
});

test("一次套好幾個：疊在一起的算同一個、照閱讀順序排", () => {
  const box = (id: string, x: number, y: number, s = 100, groupId?: string) => ({ id, x0: x, y0: y, x1: x + s, y1: y + s, groupId });
  const u = animUnits([
    box("b-frame", 200, 0), box("b-text", 220, 20, 60),   // 第二格（框＋字疊在一起）
    box("a-frame", 0, 0), box("a-circle", -10, -10, 120),  // 第一格
    box("c", 400, 0),                                       // 第三格
    box("d", 0, 200),                                       // 下一排
    box("g1", 600, 600, 50, "grp"), box("g2", 900, 900, 50, "grp"),   // 同群組、沒重疊
  ]);
  assert.equal(u.get("a-frame"), u.get("a-circle"));
  assert.equal(u.get("b-frame"), u.get("b-text"));
  assert.equal(u.get("g1"), u.get("g2"));
  assert.ok(u.get("a-frame")! < u.get("b-frame")!);
  assert.ok(u.get("b-frame")! < u.get("c")!);
  assert.ok(u.get("c")! < u.get("d")!);
  assert.equal(new Set(u.values()).size, 5);
});

test("彈出：開始前看不見、中間會超過原本大小、結束後保持原樣", () => {
  const pop = defaultAnim("popIn", "p", 1);
  const before = animFrame([pop], 0.5);
  assert.equal(before.opacity, 0);
  const peak = Math.max(...[0.5, 0.6, 0.7, 0.8].map((q) => animFrame([pop], 1 + q * pop.duration).scale));
  assert.ok(peak > 1.02);
  const after = animFrame([pop], 5);
  near(after.scale, 1); near(after.opacity, 1);
  assert.equal(animEnd(pop), 1 + pop.duration);
});

test("逐字出現：一個字一個字依序出現、跑完就整段顯示", () => {
  const ty = { ...defaultAnim("typeIn", "t", 0), typeStyle: "fade" as const };
  assert.equal(animFrame([ty], 0).typing?.p, 0);
  assert.equal(animFrame([ty], 99).typing, undefined);   // 跑完不用逐字畫
  const mid = animFrame([ty], ty.duration / 2).typing!;
  const first = typeChar(mid, 0, 10), last = typeChar(mid, 9, 10);
  near(first.opacity, 1);
  near(last.opacity, 0);
  // 打字：p=0 一個字都沒有，p 快到 1 最後一個字才出現
  const type = (p: number, i: number) => typeChar({ p, style: "type", intensity: 1 }, i, 4).opacity;
  assert.deepEqual([0, 1, 2, 3].map((i) => type(0, i)), [0, 0, 0, 0]);
  assert.deepEqual([0, 1, 2, 3].map((i) => type(0.6, i)), [1, 1, 1, 0]);
  // 飛入：還沒到的字在上面、到了回到原位
  const slide = (p: number) => typeChar({ p, style: "slide", intensity: 1 }, 0, 1);
  assert.ok(slide(0.1).dy < 0); near(slide(1).dy, 0);
});

test("讀存檔：新效果與逐字的進場方式", () => {
  const r = readAnims([{ kind: "typeIn", typeStyle: "pop", repeat: 5 }, { kind: "typeIn", typeStyle: "wiggle" }, { kind: "popIn" }])!;
  assert.equal(r.length, 3);
  assert.equal(r[0].typeStyle, "pop");
  assert.equal(r[0].repeat, 1);   // 只跑一次
  assert.equal(r[1].typeStyle, "slide");
  assert.equal(r[2].kind, "popIn");
});

test("淡入可以選方向：從反方向滑進來、到了回原位；沒選方向就原地淡入", () => {
  const still = defaultAnim("fadeIn", "f", 0);
  near(animFrame([still], 0.1).dx, 0); near(animFrame([still], 0.1).dy, 0);
  const up = { ...still, enterDir: "up" as const };   // 往上滑進來＝一開始在下面
  assert.ok(animFrame([up], 0.05).dy > 0);
  near(animFrame([up], 5).dy, 0);
  const right = { ...still, enterDir: "right" as const };
  assert.ok(animFrame([right], 0.05).dx < 0);
  const r = readAnims([{ kind: "fadeIn", enterDir: "downLeft" }, { kind: "fadeIn", enterDir: "nope" }])!;
  assert.equal(r[0].enterDir, "downLeft");
  assert.equal(r[1].enterDir, undefined);
});

test("讀存檔：時間軸的列名（去頭尾空白、太長截斷、空的不留）", () => {
  const r = readAnims([{ kind: "pulse", label: "  44折膠囊  " }, { kind: "pulse", label: "   " }, { kind: "pulse", label: "字".repeat(50) }])!;
  assert.equal(r[0].label, "44折膠囊");
  assert.equal(r[1].label, undefined);
  assert.equal(r[2].label?.length, 30);
});

test("輪播：先停、再滑一格、再停；滑完最後一張就停住", () => {
  const c = { ...defaultAnim("carousel", "c", 0), gap: 1, duration: 0.5 };   // 停 1 秒、滑 0.5 秒
  near(carouselSteps(c, 0.5, 3), 0);       // 第一段停留
  const mid = carouselSteps(c, 1.25, 3);   // 第一次滑到一半
  assert.ok(mid > 0.3 && mid < 0.7);
  near(carouselSteps(c, 2, 3), 1);         // 滑完停在第 2 張
  near(carouselSteps(c, 99, 3), 3);        // 最多滑到最後一張
  assert.equal(animEnd({ ...c, steps: 3 }), 3 * 1.5 + 0.8);
});

test("輪播的排法：間距、一開始在中間的是哪張、最多能滑幾格", () => {
  const units = [{ cx: 100 }, { cx: 400 }, { cx: 700 }, { cx: 1000 }];
  const L = carouselLayout(units.map((u) => u.cx), 400, "left");
  assert.equal(L.spacing, 300);
  assert.equal(L.focus, 1);
  assert.equal(L.maxSteps, 2);
  assert.equal(carouselLayout(units.map((u) => u.cx), 400, "right").maxSteps, 1);
  // 滑了一格：每張往左 300，原本第 3 張來到中間、放大；原本中間那張縮回
  const p2 = carouselPose(700, 1, L.spacing, "left", 400, 0.2);
  near(p2.tx, -300); near(p2.scale, 1.2);
  near(carouselPose(400, 1, L.spacing, "left", 400, 0.2).scale, 1);
});

test("讀存檔：輪播的設定", () => {
  const r = readAnims([{ kind: "carousel", group: "g1", anchorX: 540, steps: 4, blur: true, slideDir: "right" }, { kind: "carousel", slideDir: "up" }])!;
  assert.equal(r[0].group, "g1"); assert.equal(r[0].anchorX, 540); assert.equal(r[0].steps, 4); assert.equal(r[0].blur, true); assert.equal(r[0].slideDir, "right");
  assert.equal(r[1].slideDir, "left");
});

test("輪播接回第一張：滑出左邊的卡繞到最右邊補上，不留空白", () => {
  // 4 張、間距 300、焦點 x=600、一開始第 0 張在中間
  const at = (i: number, s: number, wrap: boolean) => carouselSlot(i, 4, 0, s, 300, "left", 600, 0.2, wrap);
  // 還沒滑：第 1 張在右邊一格
  near(at(1, 0, true).x, 900);
  // 滑到最後一張（3 格）：第 3 張在中間放大，右邊一格是第 0 張（繞回來了）
  near(at(3, 3, true).x, 600); near(at(3, 3, true).scale, 1.2);
  near(at(0, 3, true).x, 900);
  // 不接回：第 0 張跑到很左邊，右邊就空了
  near(at(0, 3, false).x, -300);
  // 繞回去的瞬間在畫面外（左邊兩格外才換到右邊）
  assert.ok(at(1, 3, true).x <= 0);
});

test("速度：慢／適中／快只改動作本身多快，適中＝預設；手動填的數字認不出來就是自訂", () => {
  for (const kind of ["shine", "bounce", "pulse", "twinkle", "float", "fadeIn", "popIn", "typeIn", "carousel"] as const) {
    const d = defaultAnim(kind, "x");
    assert.equal(speedOf(d), "normal", kind);
    assert.ok(SPEED_PRESETS[kind].slow > SPEED_PRESETS[kind].normal && SPEED_PRESETS[kind].normal > SPEED_PRESETS[kind].fast, kind);
  }
  const shine = defaultAnim("shine", "s");
  assert.equal(speedOf({ ...shine, duration: SPEED_PRESETS.shine.fast }), "fast");
  assert.equal(speedOf({ ...shine, duration: 0.83 }), null);
  // 間隔不算在速度裡（多選錯開的閃光，間隔是算好的）
  assert.equal(speedOf({ ...shine, gap: 9 }), "normal");
});

test("扭擺：一輪裡左右扭、最後停回原位；模糊化：從模糊變清楚", () => {
  const w = defaultAnim("wiggle", "w", 0);
  const mid = animFrame([w], w.duration * 0.15);
  assert.ok(Math.abs(mid.rot) > 0.02);
  near(animFrame([w], w.duration * 0.999).rot, 0, 0.01);
  const b = defaultAnim("blurIn", "b", 0);
  const early = animFrame([b], 0.05), later = animFrame([b], b.duration * 0.7), done = animFrame([b], 9);
  assert.ok(early.blur > later.blur && later.blur > 0);
  near(done.blur, 0); near(done.opacity, 1);
});

test("重踏：一開始很大、落地壓一下再回到原本大小；旋轉：一輪轉一圈", () => {
  const s = defaultAnim("stomp", "s", 0);
  assert.ok(animFrame([s], 0.02).scale > 1.5);
  near(animFrame([s], 9).scale, 1);
  const minScale = Math.min(...[0.62, 0.66, 0.7, 0.74, 0.78].map((q) => animFrame([s], q * s.duration).scale));
  assert.ok(minScale < 0.99);   // 落地時壓扁一點
  const r = defaultAnim("spin", "r", 0);
  near(animFrame([r], r.duration / 4).rot, Math.PI / 2);
  near(animFrame([{ ...r, ccw: true }], r.duration / 4).rot, -Math.PI / 2);
  const back = readAnims([{ kind: "spin", ccw: true }, { kind: "stomp" }, { kind: "wiggle" }, { kind: "blurIn" }])!;
  assert.deepEqual(back.map((a) => a.kind), ["spin", "stomp", "wiggle", "blurIn"]);
  assert.equal(back[0].ccw, true);
  for (const k of ["wiggle", "blurIn", "stomp", "spin"] as const) assert.equal(speedOf(defaultAnim(k, "x")), "normal");
});
