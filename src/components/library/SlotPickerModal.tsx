"use client";
/**
 * SlotPickerModal — click a composer slot → pick an existing component of that type.
 */
import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { StyleComponent, ComponentCategory } from "@/types/library";
import { CATEGORY_META, getColors } from "@/types/library";
import { ColorCards } from "./ColorCards";

type Props = {
  clientId: string | null;
  category: ComponentCategory;
  onPick: (comp: StyleComponent) => void;
  onClose: () => void;
};

export function SlotPickerModal({ clientId, category, onPick, onClose }: Props) {
  const [items, setItems] = useState<StyleComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const meta = CATEGORY_META[category];

  useEffect(() => {
    const url = clientId ? `/api/components?clientId=${clientId}` : "/api/components";
    fetch(url)
      .then((r) => r.json())
      .then((comps: StyleComponent[]) =>
        setItems(Array.isArray(comps) ? comps.filter((c) => c.type === category) : []),
      )
      .finally(() => setLoading(false));
  }, [clientId, category]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <h2 className={`text-sm font-semibold ${meta.color}`}>選擇{meta.label}積木</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-8">
              <Loader2 className="h-4 w-4 animate-spin" />載入中…
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">
              此客戶尚無{meta.label}素材，請先在「加入素材」建立。
            </div>
          ) : (
            items.map((comp) => (
              <button key={comp.id} onClick={() => { onPick(comp); onClose(); }}
                className={`w-full text-left rounded-xl border p-3 transition-all hover:shadow-md ${meta.bg} ${meta.border}`}>
                <div className="text-sm font-semibold text-gray-800 mb-1">{comp.name}</div>
                {comp.type === "COLOR_SCHEME" && <ColorCards colors={getColors(comp.data)} height="h-10" />}
                {comp.type === "COMPOSITION" && <p className="text-xs text-gray-600">{(comp.data.description as string) ?? ""}</p>}
                {comp.type === "COPY_TONE" && (
                  <div className="flex flex-wrap gap-1">
                    {((comp.data.toneLabels as string[]) ?? []).map((t, i) => (
                      <span key={i} className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">{t}</span>
                    ))}
                  </div>
                )}
                {comp.type === "BACKGROUND" && Boolean(comp.data.imageUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={comp.data.imageUrl as string} alt="bg" className="w-full h-20 object-cover rounded-lg border" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
