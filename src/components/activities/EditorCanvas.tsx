"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

type Props = {
  layout: { id: string; imageUrl: string; copyText: string; layoutType: string };
};

const COPY_TRANSFORMS = [
  { label: "再簡短一點", instruction: "請把這段文案縮短一半，保留核心意思" },
  { label: "更有衝勁", instruction: "請讓這段文案更有能量、更有購買衝動感" },
  { label: "更正式", instruction: "請讓這段文案更專業正式" },
  { label: "換諧音梗", instruction: "請在這段文案中加入一個有趣的諧音梗或雙關語" },
];

export function EditorCanvas({ layout }: Props) {
  const [copyText, setCopyText] = useState(layout.copyText);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [transforming, setTransforming] = useState(false);
  const [exporting, setExporting] = useState(false);

  const transformCopy = async (instruction: string) => {
    setTransforming(true);
    try {
      const res = await fetch("/api/transform-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copyText, instruction }),
      });
      const data = await res.json();
      setCopyText(data.result);
    } finally {
      setTransforming(false);
    }
  };

  const exportImage = async (size: "fb" | "ig") => {
    setExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: layout.imageUrl, size }),
      });
      const data = await res.json();
      const link = document.createElement("a");
      link.href = data.url;
      link.download = data.filename;
      link.target = "_blank";
      link.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-8">
      {/* Left: image preview */}
      <div className="space-y-4">
        <h2 className="font-medium">圖片預覽</h2>
        <div className="rounded-xl overflow-hidden border" style={{ backgroundColor: bgColor }}>
          <img
            src={layout.imageUrl}
            alt="Layout preview"
            className="w-full aspect-square object-cover"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">背景色</label>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            className="h-8 w-10 rounded border cursor-pointer"
          />
          <span className="text-xs text-gray-400">{bgColor}</span>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportImage("fb")} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            FB 尺寸
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportImage("ig")} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            IG 尺寸
          </Button>
        </div>
      </div>

      {/* Right: copy editor */}
      <div className="space-y-4">
        <h2 className="font-medium">文案微調</h2>
        <textarea
          value={copyText}
          onChange={(e) => setCopyText(e.target.value)}
          rows={8}
          className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black"
        />
        <div className="space-y-2">
          <div className="text-sm text-gray-500">一鍵轉換語氣：</div>
          <div className="flex flex-wrap gap-2">
            {COPY_TRANSFORMS.map((t) => (
              <Button
                key={t.label}
                variant="outline"
                size="sm"
                onClick={() => transformCopy(t.instruction)}
                disabled={transforming}
              >
                {transforming ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
