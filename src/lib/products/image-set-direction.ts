import type { ImageSetArtDirection } from "./product-visual-analysis";

export type ImageSetDirectionAdvancedField = {
  key: "lighting" | "mood" | "decorationStyle" | "backgroundLanguage" | "cameraLanguage";
  label: string;
  value: string;
};

export function imageSetDirectionAdvancedFields(direction: ImageSetArtDirection): ImageSetDirectionAdvancedField[] {
  return [
    { key: "lighting", label: "光線", value: direction.lighting },
    { key: "mood", label: "氛圍", value: direction.mood.join("、") },
    { key: "decorationStyle", label: "裝飾風格", value: direction.decorationStyle.join("、") },
    { key: "backgroundLanguage", label: "背景語言", value: direction.backgroundLanguage },
    { key: "cameraLanguage", label: "鏡頭與構圖", value: direction.cameraLanguage },
  ];
}
