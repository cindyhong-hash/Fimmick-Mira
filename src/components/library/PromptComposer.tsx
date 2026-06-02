"use client";
/**
 * PromptComposer
 * ──────────────
 * The "積木組合" panel inside the 生成圖片 tab.
 * Receives three style-component slots (layout / color / tone) that are filled
 * when the user clicks "帶入生成" on a ComponentGrid card, or can be cleared
 * individually here. The user also types a free-form "Subject" and the panel
 * compiles everything into a single structured AI prompt ready to be sent.
 */

import { useState } from "react";
import { X, Copy, Check, Sparkles, LayoutTemplate, Palette, MessageSquare, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PromptSlots, StyleComponent, ComponentCategory } from "@/types/library";
import { CATEGORY_META } from "@/types/library";

type Props = {
  slots: PromptSlots;
  onClearSlot: (slot: keyof PromptSlots) => void;
};

const SLOT_META: {
  key: keyof PromptSlots;
  category: ComponentCategory;
  icon: React.ReactNode;
  emptyLabel: string;
}[] = [
  {
    key: "layout",
    category: "COMPOSITION",
    icon: <LayoutTemplate className="h-4 w-4" />,
    emptyLabel: "尚未選取構圖風格",
  },
  {
    key: "color",
    category: "COLOR_SCHEME",
    icon: <Palette className="h-4 w-4" />,
    emptyLabel: "尚未選取配色方案",
  },
  {
    key: "tone",
    category: "COPY_TONE",
    icon: <MessageSquare className="h-4 w-4" />,
    emptyLabel: "尚未選取語氣風格",
  },
];

function buildCompiledPrompt(slots: PromptSlots, subject: string): string {
  const parts: string[] = [];
  if (slots.layout?.aiPromptText) parts.push(`[Layout: ${slots.layout.aiPromptText}]`);
  if (slots.color?.aiPromptText) parts.push(`[Color: ${slots.color.aiPromptText}]`);
  if (slots.tone?.aiPromptText) parts.push(`[Tone: ${slots.tone.aiPromptText}]`);
  if (subject.trim()) parts.push(`[Subject: ${subject.trim()}]`);
  return parts.join(", ");
}

// ─── Color swatch helper ──────────────────────────────────────────────────────
function ColorDots({ data }: { data: Record<string, unknown> }) {
  const primary = data.primaryColor as string | undefined;
  const secondary = data.secondaryColor as string | undefined;
  if (!primary) return null;
  return (
    <div className="flex gap-1 mt-1">
      <span
        className="inline-block w-4 h-4 rounded-full border border-white shadow-sm"
        style={{ backgroundColor: primary }}
        title={primary}
      />
      {secondary && (
        <span
          className="inline-block w-4 h-4 rounded-full border border-white shadow-sm"
          style={{ backgroundColor: secondary }}
          title={secondary}
        />
      )}
    </div>
  );
}

// ─── Single slot card ─────────────────────────────────────────────────────────
function SlotCard({
  slotKey,
  category,
  icon,
  emptyLabel,
  component,
  onClear,
}: {
  slotKey: keyof PromptSlots;
  category: ComponentCategory;
  icon: React.ReactNode;
  emptyLabel: string;
  component: StyleComponent | null;
  onClear: () => void;
}) {
  const meta = CATEGORY_META[category];
  const filled = !!component;

  return (
    <div
      className={`rounded-xl border p-3 transition-all ${
        filled ? `${meta.bg} ${meta.border}` : "border-dashed border-gray-200 bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${filled ? meta.color : "text-gray-400"}`}>
          {icon}
          {meta.label}
        </div>
        {filled && (
          <button
            onClick={onClear}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="移除此積木"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filled ? (
        <div>
          <div className="text-xs font-medium text-gray-800 truncate">{component.name}</div>
          {category === "COLOR_SCHEME" && <ColorDots data={component.data} />}
          {category === "COMPOSITION" && (
            <div className="text-xs text-gray-500 mt-0.5">
              {(component.data.description as string) ?? ""}
            </div>
          )}
          {category === "COPY_TONE" && (
            <div className="text-xs text-gray-500 mt-0.5">
              {((component.data.toneLabels as string[]) ?? []).join("、") || "標準語氣"}
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-400 italic">{emptyLabel}</div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PromptComposer({ slots, onClearSlot }: Props) {
  const [subject, setSubject] = useState("");
  const [copied, setCopied] = useState(false);

  const compiledPrompt = buildCompiledPrompt(slots, subject);
  const hasAnyContent = compiledPrompt.length > 0;

  const copyPrompt = async () => {
    if (!compiledPrompt) return;
    await navigator.clipboard.writeText(compiledPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b bg-gradient-to-r from-gray-50 to-white flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h3 className="font-semibold text-sm">Prompt 積木組合台</h3>
        <span className="ml-auto text-xs text-gray-400">
          從右側「風格組件」點擊「帶入生成」填入積木
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* 3 slots */}
        <div className="grid grid-cols-3 gap-3">
          {SLOT_META.map(({ key, category, icon, emptyLabel }) => (
            <SlotCard
              key={key}
              slotKey={key}
              category={category}
              icon={icon}
              emptyLabel={emptyLabel}
              component={slots[key]}
              onClear={() => onClearSlot(key)}
            />
          ))}
        </div>

        {/* Subject input */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <Target className="h-3.5 w-3.5 text-emerald-500" />
            主體物件 (Subject)
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="例：冬季除毛、夏日防曬面膜、復古腳踏車..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition"
          />
        </div>

        {/* Compiled prompt preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">編譯後的 AI Prompt</span>
            <button
              onClick={copyPrompt}
              disabled={!hasAnyContent}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                hasAnyContent
                  ? copied
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
                  : "opacity-30 cursor-not-allowed border-gray-200 text-gray-400"
              }`}
            >
              {copied ? (
                <><Check className="h-3 w-3" />已複製</>
              ) : (
                <><Copy className="h-3 w-3" />複製</>
              )}
            </button>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 min-h-[80px]">
            {hasAnyContent ? (
              <p className="text-xs text-gray-700 leading-relaxed break-all font-mono">
                {compiledPrompt}
              </p>
            ) : (
              <p className="text-xs text-gray-400 italic">選取風格積木或輸入主體後，這裡將顯示組裝好的 AI Prompt…</p>
            )}
          </div>
        </div>

        {/* Send button (placeholder) */}
        <Button
          disabled={!hasAnyContent}
          className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" />
          用此 Prompt 生成新圖
        </Button>
      </div>
    </div>
  );
}
