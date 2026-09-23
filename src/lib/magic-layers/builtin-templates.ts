import type { SavedLayer } from "./saved-layer.ts";
import data from "./builtin-templates.json" with { type: "json" };

/**
 * 內建範本：跟著程式碼走，不存資料庫。
 *
 * 原本範本只存在 StyleComponent，結果本機灌好了、正式站還是空的，換一台電腦
 * 也要再灌一次。而正式站有密碼閘，不該為了灌資料去繞過它。改成內建之後
 * 每個環境自動都有，部署就生效。
 *
 * 使用者自己按「存成範本」的仍然進資料庫——那是他們的東西，會變動、要能刪。
 * 內建的則是唯讀：刪除端點會擋下來，不然刪掉之後只能重新部署才會回來。
 *
 * 縮圖網址指向共用的 Blob，所以各環境讀到的是同一張圖。
 * 內容要更新時跑 `node scripts/export-builtin-templates.mjs` 重新產生 JSON。
 */
export type BuiltinTemplate = {
  id: string;
  name: string;
  previewUrl: string | null;
  docW: number;
  docH: number;
  /** 設計決策；舊批次沒有就是 null。 */
  art: { family: string; composition: string; negativeSpace: number; recommendedFor: string } | null;
  layers: SavedLayer[];
};

export const BUILTIN_TEMPLATES = data as unknown as BuiltinTemplate[];

/** 內建範本的 id 一律是這個開頭，用來跟資料庫那些 cuid 區分。 */
export const BUILTIN_ID_PREFIX = "builtin-";

export function isBuiltinTemplateId(id: string): boolean {
  return id.startsWith(BUILTIN_ID_PREFIX);
}

export function findBuiltinTemplate(id: string): BuiltinTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

/** 列表用：不帶 layers（可能很大，點進去套用時才需要）。 */
export function builtinTemplateSummaries() {
  return BUILTIN_TEMPLATES.map(({ layers, ...rest }) => ({
    ...rest,
    layerCount: layers.length,
    builtin: true as const,
    createdAt: "",
  }));
}
