// ─── Library / Asset types ────────────────────────────────────────────────────

export type ComponentCategory = "COMPOSITION" | "COLOR_SCHEME" | "COPY_TONE";

export const CATEGORY_META: Record<
  ComponentCategory,
  { label: string; slot: "layout" | "color" | "tone"; color: string; bg: string; border: string }
> = {
  COMPOSITION: {
    label: "構圖",
    slot: "layout",
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
  },
  COLOR_SCHEME: {
    label: "配色",
    slot: "color",
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
  },
  COPY_TONE: {
    label: "語氣",
    slot: "tone",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
};

export interface StyleComponent {
  id: string;
  name: string;
  type: ComponentCategory;
  data: Record<string, unknown>;
  clientId: string | null;
  aiPromptText: string;
  sourceLayoutId: string;
  previewUrl: string | null;
  createdAt: string;
}

export interface GeneratedAsset {
  id: string;
  imageUrl: string;
  layoutType: string;
  copyText: string;
  activity: { theme: string; clientId: string; client: { name: string } };
}

/** The three slots the PromptComposer manages */
export interface PromptSlots {
  layout: StyleComponent | null;
  color: StyleComponent | null;
  tone: StyleComponent | null;
}
