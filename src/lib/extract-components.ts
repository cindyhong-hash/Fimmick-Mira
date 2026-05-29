import type { LayoutType } from "@/types";

const COMPOSITION_DESCRIPTIONS: Record<LayoutType, string> = {
  A: "產品置中，文案下方",
  B: "產品偏右，文案左側大字",
  C: "產品滿版背景，文案疊加",
};

export type ExtractedComponents = {
  composition: { layoutType: LayoutType; description: string };
  colorScheme: { primaryColor: string; secondaryColor?: string };
  copyTone: { toneLabels: string[]; layoutType: LayoutType };
};

export function extractStyleComponents(params: {
  layoutType: LayoutType;
  primaryColor: string;
  secondaryColor?: string;
  toneLabels: string[];
}): ExtractedComponents {
  return {
    composition: {
      layoutType: params.layoutType,
      description: COMPOSITION_DESCRIPTIONS[params.layoutType],
    },
    colorScheme: {
      primaryColor: params.primaryColor,
      secondaryColor: params.secondaryColor,
    },
    copyTone: {
      toneLabels: params.toneLabels,
      layoutType: params.layoutType,
    },
  };
}
