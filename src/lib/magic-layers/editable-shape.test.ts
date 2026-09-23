import assert from "node:assert/strict";
import test from "node:test";
import { clipToShape, drawEditableShape, drawIcon, EDITABLE_ICON_NAMES, FILLABLE_SHAPE_KINDS, isFillableShape, normalizeShape, shapeGradientFill } from "./editable-shape.ts";
import { savedToLayerData, type SavedLayer } from "./saved-layer.ts";
test("keeps valid gradient/softness through saved layers and rejects invalid values", () => {
 const shape = normalizeShape({kind:"ellipse",fill:"#112233",stroke:"none",strokeWidth:0,softness:0.7,gradient:{axis:"vertical",from:"#ffffff",to:"#ffffff00"}})!;
 assert.equal(shape.softness,0.7);
 const layer = savedToLayerData({ id:"shadow",type:"object",name:"shadow",x:0,y:0,w:100,h:20,rotation:0,zIndex:0,visible:true,locked:false,opacity:0.3,shape } as SavedLayer);
 assert.deepEqual(layer.meta.shape,shape);
 assert.equal(normalizeShape({...shape,softness:Infinity}),null);
 assert.equal(normalizeShape({...shape,gradient:{axis:"diagonal",from:"red",to:"blue"}}),null, "顏色要是 hex");
 assert.equal(normalizeShape({...shape,gradient:{axis:"sideways",from:"#ffffff",to:"#000000"}}),null, "不認得的方向");
 for (const axis of ["diagonal","radial"] as const) assert.ok(normalizeShape({...shape,gradient:{axis,from:"#ff66aa",to:"#6d28d9cc"}}), axis);
});
test("draws every semantic benefit icon exposed by the editor picker", () => {
 const calls:string[]=[];
 const ctx=new Proxy({}, {get:(_target,key)=>typeof key==="string"?()=>calls.push(key):undefined}) as CanvasRenderingContext2D;
 for(const icon of ["sun","clean","repair","texture"] as const){
  assert.ok(EDITABLE_ICON_NAMES.includes(icon));
  assert.doesNotThrow(()=>drawIcon(ctx,24,icon,"#112233"));
 }
 assert.ok(calls.includes("arc"));
 assert.ok(calls.includes("bezierCurveTo"));
});

/** 記錄每個 canvas 呼叫與參數的假 ctx。 */
function recordingCtx() {
  const calls: { fn: string; args: unknown[] }[] = [];
  const gradient = { addColorStop: (...args: unknown[]) => calls.push({ fn: "addColorStop", args }) };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_t, key) => typeof key !== "string" ? undefined
      : key === "createLinearGradient" || key === "createRadialGradient" ? (...args: unknown[]) => { calls.push({ fn: key, args }); return gradient; }
      : (...args: unknown[]) => { calls.push({ fn: key, args }); },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

test("漸層四種方向：上下、左右、斜角、由中間往外，都用兩個顏色", () => {
  const cases = [
    ["vertical", "createLinearGradient", [0, -50, 0, 50]],
    ["horizontal", "createLinearGradient", [-100, 0, 100, 0]],
    ["diagonal", "createLinearGradient", [-100, -50, 100, 50]],
    ["radial", "createRadialGradient", [0, 0, 0, 0, 0, Math.hypot(100, 50)]],
  ] as const;
  for (const [axis, fn, args] of cases) {
    const { ctx, calls } = recordingCtx();
    shapeGradientFill(ctx, 200, 100, { axis, from: "#ff66aa", to: "#6d28d9cc" });
    const made = calls.find((c) => c.fn === fn);
    assert.deepEqual(made?.args, args, axis);
    assert.deepEqual(calls.filter((c) => c.fn === "addColorStop").map((c) => c.args), [[0, "#ff66aa"], [1, "#6d28d9cc"]]);
  }
});

test("漸層也畫得出圓角：以前漸層會直接畫成直角方塊", () => {
  const { ctx, calls } = recordingCtx();
  drawEditableShape(ctx, 200, 100, { kind: "rect", fill: "#ffffff", stroke: "none", strokeWidth: 0, radius: 20, gradient: { axis: "vertical", from: "#ffffff", to: "#000000" } });
  assert.ok(calls.some((c) => c.fn === "roundRect"));
  assert.ok(calls.some((c) => c.fn === "fill"));
  assert.ok(!calls.some((c) => c.fn === "fillRect"));
});

test("剪裁遮色片：有「裡面」的形狀才能當框，線條、圖標不行", () => {
  for (const kind of FILLABLE_SHAPE_KINDS) {
    const { ctx, calls } = recordingCtx();
    assert.equal(clipToShape(ctx, 100, 100, { kind, fill: "#000000", stroke: "none", strokeWidth: 0 }), true, kind);
    assert.ok(calls.some((c) => c.fn === "clip"), kind);
    assert.ok(isFillableShape({ kind, fill: "#000000", stroke: "none", strokeWidth: 0 }));
  }
  for (const kind of ["line", "icon"] as const) {
    const { ctx, calls } = recordingCtx();
    assert.equal(clipToShape(ctx, 100, 100, { kind, fill: "#000000", stroke: "#000000", strokeWidth: 2 }), false, kind);
    assert.ok(!calls.some((c) => c.fn === "clip"), kind);
  }
});

test("放進形狀的圖存檔後還記得是放在哪個形狀裡", () => {
  const layer = savedToLayerData({ id: "photo", type: "object", name: "照片", x: 0, y: 0, w: 100, h: 100, rotation: 0, zIndex: 2, visible: true, locked: false, opacity: 1, image: "/a.png", clipTo: "frame-1" } as SavedLayer);
  assert.equal(layer.meta.clipTo, "frame-1");
  const plain = savedToLayerData({ id: "p2", type: "object", name: "照片", x: 0, y: 0, w: 100, h: 100, rotation: 0, zIndex: 2, visible: true, locked: false, opacity: 1, image: "/a.png" } as SavedLayer);
  assert.equal("clipTo" in plain.meta, false);
});
