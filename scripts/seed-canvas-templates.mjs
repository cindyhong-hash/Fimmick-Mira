// 把設計公版塞進範本庫：用 headless Chromium 把每個範本渲染成縮圖，再 POST 上去。
// 縮圖用 HTML 重現（rect→div、ellipse→border-radius 50%、text→div），
// 不用 SVG＋sharp 是因為中文字型在那條路上容易缺字。
import { spawn } from "node:child_process";
import os from "node:os";
import { TEMPLATES, DOC } from "./seed-canvas-templates.data.mjs";

const CHROME = `${os.homedir()}/Library/Caches/ms-playwright/chromium-1234/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const PORT = 9337;
const API = process.env.API ?? "http://localhost:3017";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 縮圖用 HTML 重現（rect→div、ellipse→border-radius 50%、text→div），
// 不用 SVG＋sharp 是因為中文字型在那條路上容易缺字。
// 旋轉、描邊、陰影、漸層都要跟著畫，否則預覽會比實際成品平很多。
const ICON_GLYPH = {
  star: "★", heart: "♥", circle: "●", triangle: "▲", check: "✓", arrow: "→",
  plus: "＋", bolt: "⚡", "water-drop": "💧", spring: "❀", blade: "✂", shield: "🛡",
  sparkle: "✦", leaf: "🍃", sun: "☀", clean: "✧", repair: "✚", texture: "▦",
};

function layerHtml(l) {
  const rot = l.rotation ? `transform:rotate(${l.rotation}rad);` : "";
  const box = `position:absolute;left:${(l.x / DOC) * 100}%;top:${(l.y / DOC) * 100}%;width:${(l.w / DOC) * 100}%;height:${(l.h / DOC) * 100}%;opacity:${l.opacity ?? 1};${rot}`;

  if (l.isText) {
    const fx = l.fx ?? {};
    const size = (l.fontSize / DOC) * 100;
    const stroke = fx.strokeW ? `-webkit-text-stroke:${size * fx.strokeW}cqw ${fx.strokeColor || "#fff"};paint-order:stroke fill;` : "";
    const shadow = fx.shadow ? `text-shadow:0 ${size * 0.06}cqw ${size * 0.1}cqw rgba(0,0,0,.4);` : "";
    const spacing = fx.letterSpacing ? `letter-spacing:${size * fx.letterSpacing}cqw;` : "";
    const grad = fx.gradient
      ? `background:linear-gradient(180deg,${fx.gradient[0]},${fx.gradient[1]});-webkit-background-clip:text;background-clip:text;color:transparent;`
      : `color:${l.color};`;
    const justify = l.align === "left" ? "flex-start" : l.align === "right" ? "flex-end" : "center";
    return `<div style="${box}display:flex;align-items:center;justify-content:${justify};
      font-family:${l.fontFamily};font-weight:${l.fontWeight};font-size:${size}cqw;${grad}${stroke}${shadow}${spacing}white-space:pre;line-height:1.15;">${l.text}</div>`;
  }

  if (l.image) {
    return `<img src="${l.image}" style="${box}object-fit:contain;" />`;
  }
  const sh = l.shape ?? {};
  if (sh.kind === "icon") {
    return `<div style="${box}display:flex;align-items:center;justify-content:center;color:${sh.fill};font-size:${(l.w / DOC) * 100}cqw;line-height:1;">${ICON_GLYPH[sh.icon] ?? "✦"}</div>`;
  }
  const fill = sh.gradient
    ? `background:linear-gradient(${sh.gradient.axis === "horizontal" ? "90deg" : "180deg"},${sh.gradient.from},${sh.gradient.to});`
    : sh.fill && sh.fill !== "none" ? `background:${sh.fill};` : "";
  const stroke = sh.stroke && sh.stroke !== "none" ? `border:${sh.strokeWidth ?? 1}px solid ${sh.stroke};` : "";
  const radius = sh.kind === "ellipse" ? "border-radius:50%;" : sh.radius ? `border-radius:${(sh.radius / DOC) * 100}cqw;` : "";
  // softness 是柔邊光暈，用 blur 近似
  const soft = sh.softness ? `filter:blur(${sh.softness * 4}cqw);` : "";
  return `<div style="${box}${fill}${stroke}${radius}${soft}box-sizing:border-box;"></div>`;
}

const page = (layers) => `<!doctype html><meta charset="utf-8">
<body style="margin:0"><div style="position:relative;width:480px;height:480px;container-type:inline-size;background:#fff;overflow:hidden">
${layers.map(layerHtml).join("\n")}
</div></body>`;

const proc = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, "--headless=new", "--hide-scrollbars",
  "--window-size=480,480", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${os.tmpdir()}/mira-tpl-profile`,
], { stdio: "ignore" });
// Chromium 冷啟動有時要好幾秒，直接固定睡 2.5 秒會撲空。
let list = null;
for (let i = 0; i < 30 && !list; i += 1) {
  await sleep(1000);
  try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch { /* 還沒起來 */ }
}
if (!list) { console.error("Chromium 起不來"); process.exit(1); }
const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 480, height: 480, deviceScaleFactor: 2, mobile: false });

for (const tpl of TEMPLATES) {
  const layers = tpl.layers();
  await send("Page.navigate", { url: `data:text/html;charset=utf-8,${encodeURIComponent(page(layers))}` });
  await sleep(900);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const thumbnail = shot.result?.data ? `data:image/png;base64,${shot.result.data}` : undefined;

  const res = await fetch(`${API}/api/magic-layers/templates`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: tpl.name, docW: DOC, docH: DOC, layers, thumbnail }),
  });
  const body = await res.json();
  console.log(res.ok ? "✓" : "✗", tpl.name, res.ok ? "" : JSON.stringify(body));
}
ws.close(); proc.kill();
