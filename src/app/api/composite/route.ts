import { NextResponse } from "next/server";
import { compositeCollage, extractDominantColor } from "@/lib/composite-multi";
import { overlayLogo } from "@/lib/composite";
import { getCellRects } from "@/types/multiLayout";
import type { CollageStyle } from "@/lib/multi-editor";

export const maxDuration = 60;

const SIZE: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 }, "4:5": { w: 820, h: 1024 },
  "3:4": { w: 768, h: 1024 }, "2:3": { w: 683, h: 1024 },
  "9:16": { w: 576, h: 1024 }, "4:3": { w: 1024, h: 768 },
  "3:2": { w: 1024, h: 683 }, "16:9": { w: 1024, h: 576 },
};

/** 生成多圖時的拼版尺寸（見 generate-multi.ts 的 COLLAGE_PX）。 */
const GENERATED_COLLAGE_PX = 1200;

/**
 * 重新拼版：給各格圖 URL + 版型 → 合成一張拼版大圖（可選疊 logo）
 * matchGenerated：照「生成當下」的樣子拼（1200 正方形、主色淡底或滿版）——多圖微調畫布用，
 * 不然改一格整張的尺寸、底色、格縫都會跟著變。collage 沒給（舊資料）就跟生成時一樣從第 1 格抓主色。
 */
export async function POST(request: Request) {
  try {
    const { cellUrls, layoutId, ratio, logoUrl, logoMode, matchGenerated, collage } = await request.json() as {
      cellUrls: string[]; layoutId: string; ratio?: string; logoUrl?: string; logoMode?: string; matchGenerated?: boolean; collage?: CollageStyle;
    };
    if (!Array.isArray(cellUrls) || cellUrls.length === 0 || !layoutId) {
      return NextResponse.json({ error: "cellUrls and layoutId required" }, { status: 400 });
    }
    const rects = getCellRects(layoutId, cellUrls.length);

    let composite: string;
    if (matchGenerated) {
      const fullBleed = collage?.fullBleed === true;
      const accentColor = fullBleed ? undefined : (collage?.accentColor || await extractDominantColor(cellUrls[0]).catch(() => undefined));
      composite = await compositeCollage({
        cellUrls, rects, canvasWidth: GENERATED_COLLAGE_PX, canvasHeight: GENERATED_COLLAGE_PX,
        plusOverlayText: layoutId === "five-plus" && cellUrls.length > 5 ? `+${cellUrls.length - 5}` : undefined,
        gap: fullBleed ? 0 : undefined,
        accentColor,
      });
    } else {
      const size = SIZE[ratio as string] ?? { w: 1024, h: 1024 };
      composite = await compositeCollage({
        cellUrls, rects, canvasWidth: size.w, canvasHeight: size.h,
      });
    }

    if (logoMode && logoMode !== "none" && logoUrl) {
      try {
        composite = await overlayLogo({ imageUrl: composite, logoUrl, textZone: "none" });
      } catch (e) { console.warn("[composite] logo overlay failed:", e); }
    }

    return NextResponse.json({ imageUrl: composite });
  } catch (err) {
    console.error("[POST /api/composite]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
