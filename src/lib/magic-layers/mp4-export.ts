/* ============================================================
   把圖層動畫一格一格畫出來，用瀏覽器內建的 WebCodecs 壓成 H.264，再用 mp4-muxer 包成 MP4。
   全部在瀏覽器裡做，不用上傳、不花錢；臉書、IG 都吃 H.264 MP4。
   新版 Chrome、Edge、Safari 都有 VideoEncoder；沒有的瀏覽器會丟出看得懂的錯誤。
   ============================================================ */

/** 影片尺寸：長邊最多 maxSide，兩邊都要是偶數（H.264 的要求）。 */
export function videoSize(w: number, h: number, maxSide = 1600): { width: number; height: number } {
  const s = Math.min(1, maxSide / Math.max(w, h));
  const even = (n: number) => Math.max(2, Math.round((n * s) / 2) * 2);
  return { width: even(w), height: even(h) };
}

export function frameCount(duration: number, fps: number): number {
  return Math.max(1, Math.round(duration * fps));
}

/** 依尺寸挑一個瀏覽器支援的 H.264 設定（High → Main → Baseline）。 */
async function pickCodec(width: number, height: number, bitrate: number, fps: number): Promise<VideoEncoderConfig> {
  const candidates = ["avc1.640033", "avc1.640028", "avc1.4d0028", "avc1.42E01F"];
  for (const codec of candidates) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps, avc: { format: "avc" } };
    try {
      const r = await VideoEncoder.isConfigSupported(config);
      if (r.supported) return config;
    } catch { /* 換下一個 */ }
  }
  throw new Error("這個瀏覽器不支援輸出 MP4，請改用最新版 Chrome 或 Safari");
}

export async function encodeMp4(opts: {
  width: number; height: number; fps: number; duration: number;
  /** 畫第 t 秒那一格（ctx 已經是 width×height）。 */
  renderFrame: (ctx: CanvasRenderingContext2D, t: number) => void;
  onProgress?: (done: number, total: number) => void;
}): Promise<Blob> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
    throw new Error("這個瀏覽器不支援輸出 MP4，請改用最新版 Chrome 或 Safari");
  }
  const { width, height, fps, duration } = opts;
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const bitrate = Math.round(Math.min(12_000_000, Math.max(2_000_000, width * height * fps * 0.12)));
  const config = await pickCodec(width, height, bitrate, fps);

  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "avc", width, height, frameRate: fps }, fastStart: "in-memory" });
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { failure = e; },
  });
  encoder.configure(config);

  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const total = frameCount(duration, fps);
  const frameUs = 1_000_000 / fps;
  for (let i = 0; i < total; i++) {
    if (failure) break;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    opts.renderFrame(ctx, i / fps);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    // 別讓待壓的格子堆太多（記憶體會爆），也順便讓畫面有機會更新進度
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
    if (i % 6 === 0) { opts.onProgress?.(i + 1, total); await new Promise((r) => setTimeout(r, 0)); }
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure instanceof Error ? failure : new Error(String(failure));
  muxer.finalize();
  opts.onProgress?.(total, total);
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
