import type { SavedLayer } from "./saved-layer.ts";

/**
 * 自由畫布的範本。
 *
 * 範本就是一份存起來的圖層 JSON——編輯器本來就用 `SavedLayer[]` 進出
 * （`serializeLayers()` 存、`savedToLayerData()` 還原），所以套用之後每個
 * 圖層天生就能拖、能改字、能換圖，不需要另外做「可編輯」。
 *
 * 存在 `StyleComponent` 這張表（`type = CANVAS_TEMPLATE`），不另開 model：
 * 它已經有 `data`(JSON)、`previewUrl`(縮圖)、`name`、`clientId`，欄位剛好夠用，
 * 而且不動 schema 就不用對遠端 Turso 跑遷移（那是專案紅線）。
 *
 * 目前一律共用（`clientId = null`，所有品牌看得到）。
 * 比例原本只收 1:1；2026-09-29 放寬成 1:2～2:1（直式 3:4、4:5 的貼文範本），
 * 編輯器套用時本來就會照範本的 docW/docH 換畫布尺寸。
 */
export const CANVAS_TEMPLATE_TYPE = "CANVAS_TEMPLATE";

/** 內建範本的預設尺寸（1:1）。 */
export const CANVAS_TEMPLATE_SIZE = 1200;
/** 範本可以接受的長寬比範圍與最大邊長：太極端的比例、太大的畫布都不收。 */
const MAX_TEMPLATE_RATIO = 2;
const MAX_TEMPLATE_SIDE = 4000;

export type CanvasTemplate = {
  id: string;
  name: string;
  /** 縮圖網址；列表用。 */
  previewUrl: string | null;
  docW: number;
  docH: number;
  layers: SavedLayer[];
  createdAt: string;
};

/** 存進 `StyleComponent.data` 的形狀。 */
export type CanvasTemplatePayload = {
  docW: number;
  docH: number;
  layers: SavedLayer[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * 檢查並正規化要存起來的範本內容。
 *
 * 只擋「壞掉會讓編輯器爆掉」的情況（空圖層、尺寸不對、layers 不是陣列），
 * 不去驗每個圖層的每個欄位——`savedToLayerData()` 對缺欄位本來就有預設值，
 * 驗太細只會讓未來加圖層屬性時這裡先壞掉。
 *
 * @throws 內容不合法時丟出可以直接顯示給使用者的中文訊息
 */
export function parseCanvasTemplatePayload(value: unknown): CanvasTemplatePayload {
  if (!isPlainObject(value)) throw new Error("範本內容格式不正確");
  const { docW, docH, layers } = value;
  if (typeof docW !== "number" || typeof docH !== "number" || docW <= 0 || docH <= 0) {
    throw new Error("範本尺寸不正確");
  }
  if (docW > MAX_TEMPLATE_SIDE || docH > MAX_TEMPLATE_SIDE) throw new Error("範本尺寸太大");
  if (Math.max(docW / docH, docH / docW) > MAX_TEMPLATE_RATIO) throw new Error("範本比例只支援 1:2 到 2:1");
  if (!Array.isArray(layers) || layers.length === 0) throw new Error("空白畫布不能存成範本");
  for (const layer of layers) {
    if (!isPlainObject(layer) || typeof layer.id !== "string" || typeof layer.type !== "string") {
      throw new Error("範本的圖層資料不完整");
    }
  }
  return { docW, docH, layers: layers as SavedLayer[] };
}

/** 資料庫那一列 → 前端用的範本。壞掉的列回 null，讓列表略過而不是整包失敗。 */
export function rowToCanvasTemplate(row: {
  id: string; name: string; data: string; previewUrl: string | null; createdAt: Date | string;
}): CanvasTemplate | null {
  try {
    const payload = parseCanvasTemplatePayload(JSON.parse(row.data || "{}"));
    return {
      id: row.id,
      name: row.name || "未命名範本",
      previewUrl: row.previewUrl,
      docW: payload.docW,
      docH: payload.docH,
      layers: payload.layers,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}
