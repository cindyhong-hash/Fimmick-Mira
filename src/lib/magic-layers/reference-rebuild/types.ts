/* ============================================================
   照參考圖重做 —— 伺服器與瀏覽器共用的型別

   伺服器負責「看圖、擦字、去背」這些要花錢、要金鑰的步驟，回傳 RebuildResult；
   瀏覽器再用編輯器實際載入的字體量字，把每段文字的字級與位置算出來。
   字級一定要在瀏覽器量：同一段字換一套字體寬度就不同，伺服器量到的跟畫布上畫的會對不上。
   ============================================================ */

/** 文件座標（px），左上角為原點。 */
export type Box = { x: number; y: number; w: number; h: number };

export type RebuildText = {
  text: string;
  /** 字跡實際佔的範圍（已經用像素校正過，貼齊筆畫）。 */
  box: Box;
  color: string;
  weight: number;
  family: "sans" | "serif";
  italic: boolean;
  align: "left" | "center" | "right";
  /** 直排：一個字一行往下排。 */
  vertical: boolean;
  letterSpacingEm: number;
  rotationDeg: number;
  /** 被產品擋住一部分的字要放在產品圖層下面。 */
  behindProduct: boolean;
};

export type RebuildShape = { kind: "rect" | "pill" | "circle"; box: Box; fill: string; opacity: number };

export type RebuildProduct = { url: string; box: Box; label: string };

export type RebuildResult = {
  docW: number;
  docH: number;
  /** 擦掉文字、產品、重建色塊後的乾淨底圖。 */
  backgroundUrl: string;
  shapes: RebuildShape[];
  products: RebuildProduct[];
  texts: RebuildText[];
};
