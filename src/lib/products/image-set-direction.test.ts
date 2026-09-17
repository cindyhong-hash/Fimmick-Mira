import assert from "node:assert/strict";
import test from "node:test";
import { imageSetDirectionAdvancedFields } from "./image-set-direction.ts";

test("advanced direction fields retain AI scene guidance without exposing product identity controls", () => {
  const fields = imageSetDirectionAdvancedFields({
    concept: "清新衛浴日常保養素材",
    palette: { dominant: ["白", "冰藍"], accent: ["#ffeb85"] },
    lighting: "柔和晨光",
    materials: ["塑膠", "金屬"],
    backgroundLanguage: "明亮衛浴空間",
    cameraLanguage: "清晰近拍，保留留白",
    consistencyRules: ["保留產品原貌"],
    mood: ["清新", "日系"],
    decorationStyle: ["簡約", "專業"],
  });

  assert.deepEqual(fields, [
    { key: "lighting", label: "光線", value: "柔和晨光" },
    { key: "mood", label: "氛圍", value: "清新、日系" },
    { key: "decorationStyle", label: "裝飾風格", value: "簡約、專業" },
    { key: "backgroundLanguage", label: "背景語言", value: "明亮衛浴空間" },
    { key: "cameraLanguage", label: "鏡頭與構圖", value: "清晰近拍，保留留白" },
  ]);
});
