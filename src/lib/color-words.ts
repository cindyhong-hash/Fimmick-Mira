/**
 * 色碼轉成可讀的顏色文字。
 *
 * 生圖模型會把提示詞裡的 `#3b82f6` 當成畫面上要寫的字描上去——實測商品套圖
 * 那邊生出過帶色碼的圖。負面句（「不要畫出色碼」）對它沒有作用，唯一可靠的
 * 做法是提示詞裡根本不要出現色碼。
 *
 * 原本只有商品套圖流程（image-set-prompts）有這套轉換，素材庫那條沒有，
 * 而且翻譯器還明講「preserve exact color hex codes」。抽到這裡共用。
 */

export function describeHexColor(value: string): string | null {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!match) return null;

  const raw = match[1];
  const expanded = raw.length <= 4
    ? raw.split("").map((part) => `${part}${part}`).join("")
    : raw;
  const red = Number.parseInt(expanded.slice(0, 2), 16) / 255;
  const green = Number.parseInt(expanded.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(expanded.slice(4, 6), 16) / 255;
  const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta > 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * (((blue - red) / delta) + 2);
    else hue = 60 * (((red - green) / delta) + 4);
  }
  if (hue < 0) hue += 360;

  const alphaWord = alpha < 0.12 ? "near-transparent" : alpha < 0.85 ? "translucent" : alpha < 0.99 ? "slightly translucent" : "";
  if (saturation < 0.12) {
    const neutral = lightness > 0.88 ? "off-white" : lightness > 0.68 ? "light gray" : lightness < 0.22 ? "near-black" : "neutral gray";
    return [alphaWord, neutral].filter(Boolean).join(" ");
  }

  const hueName = hue < 15 || hue >= 345 ? "red"
    : hue < 40 ? "orange"
      : hue < 68 ? "yellow"
        : hue < 155 ? "green"
          : hue < 190 ? "teal"
            : hue < 250 ? "blue"
              : hue < 290 ? "violet"
                : hue < 330 ? "magenta"
                  : "pink";
  const warmth = hue >= 35 && hue < 68 ? "warm" : "";
  const lightnessWord = lightness > 0.86 ? "very light" : lightness > 0.66 ? "light" : lightness < 0.22 ? "deep" : lightness < 0.38 ? "dark" : "";
  const saturationWord = warmth ? "" : saturation > 0.72 ? "vivid" : saturation < 0.35 ? "muted" : "";
  return [alphaWord, warmth, lightnessWord, saturationWord, hueName].filter(Boolean).join(" ");
}

/** 十六進位色碼（含選擇性 alpha）。用於把整段文字裡的色碼換成顏色文字。 */
const HEX_IN_TEXT = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/gi;

/**
 * 把一段文字裡所有色碼換成可讀的顏色描述，其餘內容原封不動。
 *
 * 用在送進生圖模型之前。色碼有兩個來源：使用者選的品牌色板，以及潤色模型
 * 自己在場景敘述裡塞的（實測出現過 `#9ee7ff`），所以不能只處理色板那一份。
 *
 * @returns 轉換後的文字；認不出來的色碼字串原樣保留。
 */
export function describeHexCodesInText(text: string): string {
  return text.replace(HEX_IN_TEXT, (match) => describeHexColor(match) ?? match);
}
