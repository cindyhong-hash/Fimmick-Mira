"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type StyleComponent = {
  id: string;
  name: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  COMPOSITION: "構圖",
  COLOR_SCHEME: "配色",
  COPY_TONE: "語氣",
};

export function ComponentGrid() {
  const [components, setComponents] = useState<StyleComponent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/components")
      .then((r) => r.json())
      .then(setComponents)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">載入中...</div>;
  if (components.length === 0)
    return <div className="text-center py-20 text-gray-400">還沒有儲存任何風格組件</div>;

  const grouped = components.reduce<Record<string, StyleComponent[]>>((acc, c) => {
    acc[c.type] = [...(acc[c.type] ?? []), c];
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <h3 className="font-medium text-sm text-gray-500 mb-3">{TYPE_LABELS[type]}</h3>
          <div className="grid grid-cols-4 gap-3">
            {items.map((comp) => (
              <div
                key={comp.id}
                className="border rounded-lg p-3 text-sm hover:border-gray-400 cursor-pointer transition-colors"
              >
                <div className="font-medium truncate text-xs">{comp.name}</div>
                {type === "COLOR_SCHEME" && (
                  <div className="flex gap-1 mt-2">
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: (comp.data as { primaryColor: string }).primaryColor }}
                      title={(comp.data as { primaryColor: string }).primaryColor}
                    />
                    {(comp.data as { secondaryColor?: string }).secondaryColor && (
                      <div
                        className="w-6 h-6 rounded border"
                        style={{
                          backgroundColor: (comp.data as { secondaryColor: string }).secondaryColor,
                        }}
                        title={(comp.data as { secondaryColor: string }).secondaryColor}
                      />
                    )}
                  </div>
                )}
                {type === "COMPOSITION" && (
                  <div className="text-xs text-gray-500 mt-1">
                    {(comp.data as { description: string }).description}
                  </div>
                )}
                {type === "COPY_TONE" && (
                  <div className="text-xs text-gray-500 mt-1">
                    {((comp.data as { toneLabels: string[] }).toneLabels ?? []).join("、") || "標準"}
                  </div>
                )}
                <Badge variant="outline" className="text-xs mt-2">
                  {TYPE_LABELS[type]}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
