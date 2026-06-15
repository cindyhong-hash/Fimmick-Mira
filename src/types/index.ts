export type LayoutType = "A" | "B" | "C";

export type TextZone = "top-left" | "top-full" | "top-center" | "bottom-full" | "none";

export type LayoutConfig = {
  type: LayoutType;
  label: string;
  description: string;
  compositionPrompt: string;
  textZone: TextZone;
};

export const LAYOUT_CONFIGS: LayoutConfig[] = [
  {
    type: "A",
    label: "產品置中",
    description: "產品置中，文案下方，清晰展示",
    compositionPrompt: `Layout A — Product Hero Shot. Product occupies right 55% of frame, slightly off-center, angled 10-15° for dynamism. Left 40% is clean typography zone. Lighting: 3-point product lighting with warm key light top-right. Overall feel: Apple product launch, clean and premium.`,
    textZone: "top-left",
  },
  {
    type: "B",
    label: "視覺強烈",
    description: "產品偏右，文案左側大字，設計感強",
    compositionPrompt: `Layout B — High Impact Full Bleed. Product integrated INTO the environment. MASSIVE headline taking up 35-40% of image height as design element. One dominant color temperature. Energy: kinetic, bold, asymmetric like a Nike billboard.`,
    textZone: "top-full",
  },
  {
    type: "C",
    label: "氣氛感",
    description: "產品滿版背景，文案疊加，品牌形象",
    compositionPrompt: `Layout C — Mood and Atmosphere Editorial. Lifestyle-first composition, product exists naturally in scene. Generous negative space. Soft directional natural light. Color grading: desaturated with one accent color pop. Vogue editorial feel, luxury magazine aesthetic.`,
    textZone: "top-center",
  },
];
