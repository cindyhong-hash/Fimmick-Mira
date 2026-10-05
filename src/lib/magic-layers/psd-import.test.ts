import assert from "node:assert/strict";
import test from "node:test";
import { fontFromPostScript, planPsdImport, psdColorToHex, type ImportImage, type ImportText } from "./psd-import.ts";

const px = { fake: "canvas" };

test("字型：PostScript 名稱換成畫布的字型和粗細", () => {
  assert.deepEqual(fontFromPostScript("NotoSansTC-Bold"), { fontFamily: "'Noto Sans TC',system-ui,sans-serif", fontWeight: 700 });
  assert.deepEqual(fontFromPostScript("SourceHanSansTC-Heavy"), { fontFamily: "'Noto Sans TC',system-ui,sans-serif", fontWeight: 900 });
  assert.equal(fontFromPostScript("NotoSerifTC-SemiBold").fontWeight, 600);
  assert.equal(fontFromPostScript("PingFangTC-Light").fontFamily, "'PingFang TC',system-ui,sans-serif");
  // 不認得的字型：照原名拆成有空格的家族名，後面接預設字型
  assert.equal(fontFromPostScript("HelveticaNeue-Medium").fontFamily, "'Helvetica Neue','Noto Sans TC',system-ui,sans-serif");
  assert.equal(fontFromPostScript("HelveticaNeue-Medium").fontWeight, 500);
  assert.equal(fontFromPostScript("Arial", true).fontWeight, 700);
  assert.equal(psdColorToHex({ r: 255, g: 16, b: 0 }), "#ff1000");
});

test("兩個工作區域 → 兩頁，座標換成各自工作區域的", () => {
  const plan = planPsdImport({
    width: 3000, height: 2000,
    children: [
      { name: "IG 貼文", artboard: { rect: { left: 0, top: 0, right: 1080, bottom: 1080 } }, children: [
        { name: "照片", left: 100, top: 200, right: 600, bottom: 700, canvas: px },
      ] },
      { name: "限動", artboard: { rect: { left: 1200, top: 0, right: 2280, bottom: 1920 }, backgroundType: 3 }, children: [
        { name: "標題", left: 1300, top: 100, right: 1900, bottom: 220, canvas: px },
      ] },
    ],
  });
  assert.equal(plan.pages.length, 2);
  assert.deepEqual(plan.pages.map((p) => [p.name, p.w, p.h]), [["IG 貼文", 1080, 1080], ["限動", 1080, 1920]]);
  // 第 1 頁：白色背景＋照片；第 2 頁背景設成透明，不加背景
  assert.deepEqual(plan.pages[0].layers.map((l) => l.kind), ["rect", "image"]);
  assert.deepEqual(plan.pages[1].layers.map((l) => l.kind), ["image"]);
  const title = plan.pages[1].layers[0];
  assert.deepEqual([title.x, title.y, title.w, title.h], [100, 100, 600, 120]);
});

test("沒有工作區域 → 一頁；群組一路拆開，隱藏和透明度往下傳", () => {
  const plan = planPsdImport({
    width: 1200, height: 1500,
    children: [
      { name: "背景", left: 0, top: 0, right: 1200, bottom: 1500, canvas: px },
      { name: "商品組", opacity: 0.5, hidden: true, children: [
        { name: "瓶子", left: 10, top: 10, right: 110, bottom: 310, canvas: px },
        { name: "內層", children: [{ name: "陰影", left: 0, top: 300, right: 120, bottom: 330, canvas: px, opacity: 0.4 }] },
      ] },
      { name: "曲線", adjustment: { type: "curves" } },
      { name: "空的", left: 5, top: 5, right: 5, bottom: 5, canvas: px },
    ],
  });
  assert.equal(plan.pages.length, 1);
  const ls = plan.pages[0].layers;
  assert.deepEqual(ls.map((l) => l.name), ["背景", "瓶子", "陰影"]);
  assert.equal(ls[1].visible, false);
  assert.equal(ls[1].opacity, 0.5);
  assert.equal(ls[2].opacity, 0.2);
  // 「內層」只有一個圖層，不用設成群組；「瓶子」那組也只剩它自己一個
  assert.equal(ls[1].groupId, null);
  assert.deepEqual(plan.skipped.map((s) => s.layer), ["曲線", "空的"]);
});

test("同一個群組有兩個以上的圖層 → 設成同一組", () => {
  const plan = planPsdImport({ width: 500, height: 500, children: [
    { name: "標籤", children: [
      { name: "底", left: 0, top: 0, right: 100, bottom: 40, canvas: px },
      { name: "字", left: 10, top: 5, right: 90, bottom: 35, canvas: px },
    ] },
  ] });
  const [a, b] = plan.pages[0].layers;
  assert.ok(a.groupId);
  assert.equal(a.groupId, b.groupId);
});

test("文字圖層 → 可以改字：字級乘上變形、顏色、對齊、分段樣式、陰影", () => {
  const plan = planPsdImport({ width: 1000, height: 1000, children: [
    { name: "主標", left: 100, top: 100, right: 700, bottom: 220, canvas: px,
      effects: { dropShadow: [{ enabled: true, color: { r: 0, g: 0, b: 0 }, opacity: 0.5, angle: 120, distance: { value: 6 }, size: { value: 10 } }] },
      text: {
        text: "夏日\r限定", transform: [2, 0, 0, 2, 100, 160],
        style: { font: { name: "NotoSansTC-Black" }, fontSize: 40, fillColor: { r: 17, g: 17, b: 17 } },
        styleRuns: [
          { length: 3, style: { font: { name: "NotoSansTC-Black" }, fontSize: 40, fillColor: { r: 17, g: 17, b: 17 } } },
          { length: 2, style: { font: { name: "NotoSansTC-Black" }, fontSize: 60, fillColor: { r: 255, g: 0, b: 0 } } },
        ],
        paragraphStyle: { justification: "center" },
      } },
  ] });
  const t = plan.pages[0].layers[0] as ImportText;
  assert.equal(t.kind, "text");
  assert.equal(t.text, "夏日\n限定");
  assert.equal(t.fontSize, 80);
  assert.equal(t.fontWeight, 900);
  assert.equal(t.color, "#111111");
  assert.equal(t.align, "center");
  assert.deepEqual(t.runs, [{ start: 3, end: 5, fontSize: 120, color: "#ff0000" }]);
  assert.deepEqual(t.shadow, { color: "#000000", opacity: 0.5, distance: 6, blur: 10, angle: 60 });
});

test("直排文字、剪裁遮色片、圖層遮色片、混合模式：改成圖片並列在報告裡", () => {
  const plan = planPsdImport({ width: 800, height: 800, children: [
    { name: "照片", left: 0, top: 0, right: 400, bottom: 400, canvas: px },
    { name: "貼進照片的色塊", left: 0, top: 0, right: 400, bottom: 400, canvas: px, clipping: true, blendMode: "multiply" },
    { name: "直排字", left: 500, top: 0, right: 560, bottom: 400, canvas: px, text: { text: "直排標題", orientation: "vertical" } },
    { name: "有遮色片", left: 0, top: 500, right: 300, bottom: 700, canvas: px, mask: { canvas: px, left: 0, top: 500, defaultColor: 0 } },
  ] });
  const ls = plan.pages[0].layers;
  assert.deepEqual(ls.map((l) => l.kind), ["image", "image", "image", "image"]);
  assert.equal((ls[1] as ImportImage).clipBase, 0);
  assert.ok((ls[3] as ImportImage).mask);
  const reasons = plan.approximated.map((a) => a.layer);
  assert.ok(reasons.includes("貼進照片的色塊"));
  assert.ok(reasons.includes("直排字"));
  assert.ok(reasons.includes("有遮色片"));
});

test("轉了角度的文字、文字外框、圖片外框和陰影", () => {
  const ang = -0.1, c = Math.cos(ang), si = Math.sin(ang);
  const plan = planPsdImport({ width: 1000, height: 1000, children: [
    { name: "斜標題", left: 100, top: 100, right: 500, bottom: 200, canvas: px,
      effects: { stroke: [{ enabled: true, color: { r: 255, g: 255, b: 255 }, size: { value: 4 }, opacity: 1, position: "outside", fillType: "color" }], bevel: { enabled: true } },
      text: { text: "隨手補一下", transform: [2 * c, 2 * si, -2 * si, 2 * c, 300, 150], style: { font: { name: "SweiGothicCJKtc-Bold" }, fontSize: 40 } } },
    { name: "貼紙", left: 600, top: 600, right: 700, bottom: 700, canvas: px,
      effects: { stroke: [{ enabled: true, color: { r: 255, g: 255, b: 255 }, size: { value: 6 }, fillType: "color" }],
        dropShadow: [{ enabled: true, color: { r: 0, g: 0, b: 0 }, opacity: 0.35, angle: 90, distance: { value: 3 }, size: { value: 7 } }],
        outerGlow: { enabled: true, color: { r: 255, g: 255, b: 255 }, opacity: 0.35, size: { value: 12 } } } },
  ] });
  const [t, img] = plan.pages[0].layers as [ImportText, ImportImage];
  assert.equal(t.fontFamily, "'Noto Sans TC',system-ui,sans-serif");
  assert.equal(t.rotation, -0.1);
  // 轉完的外框 400×100 → 換回沒轉的字框（約 396×61），中心不變
  assert.ok(Math.abs(t.w - 395.91) < 0.1 && Math.abs(t.h - 60.78) < 0.1);
  assert.ok(Math.abs(t.x + t.w / 2 - 300) < 0.5 && Math.abs(t.y + t.h / 2 - 150) < 0.5);
  assert.deepEqual(t.fx, { strokeColor: "#ffffff", strokeW: 0.1 });
  assert.ok(plan.approximated.some((a) => a.layer === "斜標題" && a.reason.includes("斜角和浮雕")));
  // 圖片外框：圖層往外長 6px；陰影、外光暈照數值帶過去
  assert.deepEqual([img.x, img.y, img.w, img.h], [594, 594, 112, 112]);
  assert.deepEqual(img.stroke, { color: "#ffffff", size: 6, opacity: 1 });
  assert.deepEqual(img.shadow, { color: "#000000", opacity: 0.35, distance: 3, blur: 7, angle: 90 });
  assert.deepEqual(img.glow, { color: "#ffffff", size: 12, opacity: 0.35, strength: 2 });
});

test("最底下鋪滿整頁的照片當成背景（生成式填色才看得到畫面）", () => {
  const plan = planPsdImport({ width: 1000, height: 1000, children: [
    { name: "白底", left: 0, top: 0, right: 1000, bottom: 1000, canvas: px },
    { name: "照片", left: -20, top: 0, right: 1050, bottom: 1000, canvas: px },
    { name: "小圖", left: 100, top: 100, right: 300, bottom: 300, canvas: px },
    { name: "上面又一張滿版", left: 0, top: 0, right: 1000, bottom: 1000, canvas: px },
  ] });
  const ls = plan.pages[0].layers as ImportImage[];
  // 從底下連續鋪滿的兩張都是背景；中間隔了小圖，上面那張滿版就不算
  assert.deepEqual(ls.map((l) => !!l.background), [true, true, false, false]);
});
