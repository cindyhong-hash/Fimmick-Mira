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

function layerHtml(l) {
  const box = `position:absolute;left:${(l.x / DOC) * 100}%;top:${(l.y / DOC) * 100}%;width:${(l.w / DOC) * 100}%;height:${(l.h / DOC) * 100}%;opacity:${l.opacity ?? 1};`;
  if (l.isText) {
    return `<div style="${box}display:flex;align-items:center;justify-content:${l.align === "left" ? "flex-start" : l.align === "right" ? "flex-end" : "center"};
      font-family:${l.fontFamily};font-weight:${l.fontWeight};font-size:${(l.fontSize / DOC) * 100}cqw;color:${l.color};white-space:pre;line-height:1.15;">${l.text}</div>`;
  }
  const s = l.shape ?? {};
  const fill = s.gradient
    ? `background:linear-gradient(${s.gradient.axis === "horizontal" ? "90deg" : "180deg"},${s.gradient.from},${s.gradient.to});`
    : s.fill && s.fill !== "none" ? `background:${s.fill};` : "";
  const stroke = s.stroke && s.stroke !== "none" ? `border:${(s.strokeWidth ?? 1)}px solid ${s.stroke};` : "";
  const radius = s.kind === "ellipse" ? "border-radius:50%;" : s.radius ? `border-radius:${s.radius}px;` : "";
  return `<div style="${box}${fill}${stroke}${radius}box-sizing:border-box;"></div>`;
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
