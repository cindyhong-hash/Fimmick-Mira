"use client";
/**
 * BrandMemoryCards — wireframe v2 ④⑤ 品牌工作區頂部嘅兩張記憶卡：
 *   • AI 已學習嘅品牌記憶（BRAND GUIDELINES）：主色／輔色／palette 色票 + 語調
 *   • 風格禁忌（NEGATIVE PROMPTS）：taboos
 * 純展示現有品牌設定資料（AI 風格 DNA 自動掃描＝OAuth 依賴，排 backlog）。
 */
import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";

type BrandMemory = {
  primaryColor?: string;
  secondaryColor?: string | null;
  paletteColors?: unknown;
  toneLabels?: string[];
  taboos?: string[];
};

function parseColors(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string") as string[];
  if (typeof raw === "string") {
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((x) => typeof x === "string") : []; }
    catch { return []; }
  }
  return [];
}

export function BrandMemoryCards({ clientId }: { clientId: string }) {
  const [m, setM] = useState<BrandMemory | null>(null);

  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/clients/${clientId}`).then((r) => r.json()).then(setM).catch(() => {});
  }, [clientId]);

  if (!m) return null;

  const colors = [m.primaryColor, m.secondaryColor, ...parseColors(m.paletteColors)]
    .filter((c): c is string => !!c)
    .filter((c, i, arr) => arr.indexOf(c) === i);
  const tones = m.toneLabels ?? [];
  const taboos = m.taboos ?? [];

  return (
    // wireframe ④：1fr/1fr · gap 10px · items-start（唔強制等高，空卡唔會被拉長）
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5 items-start">
      {/* BRAND GUIDELINES */}
      <div className="bg-[#f4f3ee] border border-gray-200/70 rounded-lg px-3 py-2.5">
        <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-600 shrink-0" /> AI 已學習嘅品牌記憶（BRAND GUIDELINES）
        </p>
        {colors.length > 0 ? (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {colors.map((c) => (
              <span key={c} className="text-[11px] px-2 py-0.5 rounded-full border"
                style={{ background: c, color: textOn(c), borderColor: "rgba(0,0,0,0.12)" }}>
                {c}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-2">未設定品牌色 —— 去「品牌設定」加入</p>
        )}
        <p className="text-xs text-gray-600">
          語調：{tones.length > 0 ? tones.join("、") : <span className="text-gray-400">未設定</span>}
        </p>
      </div>

      {/* NEGATIVE PROMPTS */}
      <div className="bg-[#faeeda] border border-amber-200/80 rounded-lg px-3 py-2.5">
        <p className="text-xs font-medium mb-2 flex items-center gap-1.5 text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> 風格禁忌（NEGATIVE PROMPTS）
        </p>
        {taboos.length > 0 ? (
          <div className="flex gap-1.5 flex-wrap">
            {taboos.map((t) => (
              <span key={t} className="text-[11px] bg-white/70 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5">{t}</span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-amber-700/70 leading-relaxed">未設定禁忌 —— 去「品牌設定」加入，生成時會自動避開</p>
        )}
      </div>
    </div>
  );
}

/** 依背景色光度決定文字用黑定白（色票 pill 可讀性）。 */
function textOn(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#1a1a18";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#1a1a18" : "#ffffff";
}
