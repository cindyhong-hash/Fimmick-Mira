"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const TONE_OPTIONS = ["幽默有梗", "專業嚴謹", "高冷奢華", "親切溫暖", "年輕活力"];

export type BrandFormValues = {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  toneLabels: string[];
  taboos: string[];
};

type Props = {
  initialValues?: Partial<BrandFormValues>;
  onSubmit: (values: BrandFormValues) => Promise<void>;
  submitLabel?: string;
};

export function BrandSettingsForm({ initialValues, onSubmit, submitLabel = "儲存" }: Props) {
  const [values, setValues] = useState<BrandFormValues>({
    name: initialValues?.name ?? "",
    primaryColor: initialValues?.primaryColor ?? "#000000",
    secondaryColor: initialValues?.secondaryColor ?? "",
    toneLabels: initialValues?.toneLabels ?? [],
    taboos: initialValues?.taboos ?? [],
  });
  const [tabooInput, setTabooInput] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleTone = (tone: string) => {
    setValues((v) => ({
      ...v,
      toneLabels: v.toneLabels.includes(tone)
        ? v.toneLabels.filter((t) => t !== tone)
        : v.toneLabels.length < 2
        ? [...v.toneLabels, tone]
        : v.toneLabels,
    }));
  };

  const addTaboo = () => {
    const t = tabooInput.trim();
    if (t && !values.taboos.includes(t)) {
      setValues((v) => ({ ...v, taboos: [...v.taboos, t] }));
      setTabooInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(values);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="space-y-1">
        <Label>客戶名稱 *</Label>
        <Input
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="例：ABC 品牌"
          required
        />
      </div>

      <div className="flex gap-4">
        <div className="space-y-1 flex-1">
          <Label>主色 *</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={values.primaryColor}
              onChange={(e) => setValues((v) => ({ ...v, primaryColor: e.target.value }))}
              className="h-9 w-12 rounded border cursor-pointer"
            />
            <Input
              value={values.primaryColor}
              onChange={(e) => setValues((v) => ({ ...v, primaryColor: e.target.value }))}
              placeholder="#000000"
            />
          </div>
        </div>
        <div className="space-y-1 flex-1">
          <Label>輔色</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={values.secondaryColor || "#ffffff"}
              onChange={(e) => setValues((v) => ({ ...v, secondaryColor: e.target.value }))}
              className="h-9 w-12 rounded border cursor-pointer"
            />
            <Input
              value={values.secondaryColor}
              onChange={(e) => setValues((v) => ({ ...v, secondaryColor: e.target.value }))}
              placeholder="#ffffff"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>品牌調性（最多選 2 個）</Label>
        <div className="flex flex-wrap gap-2">
          {TONE_OPTIONS.map((tone) => (
            <button
              key={tone}
              type="button"
              onClick={() => toggleTone(tone)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                values.toneLabels.includes(tone)
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
              }`}
            >
              {tone}
            </button>
          ))}
        </div>
        {values.toneLabels.length === 2 && (
          <p className="text-xs text-gray-400">已選滿 2 個，請先取消一個再選</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>禁忌事項</Label>
        <div className="flex gap-2">
          <Input
            value={tabooInput}
            onChange={(e) => setTabooInput(e.target.value)}
            placeholder="例：不可出現競品名稱"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addTaboo(); }
            }}
          />
          <Button type="button" variant="outline" onClick={addTaboo}>加入</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {values.taboos.map((t) => (
            <Badge key={t} variant="secondary" className="flex items-center gap-1">
              {t}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setValues((v) => ({ ...v, taboos: v.taboos.filter((x) => x !== t) }))}
              />
            </Badge>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "儲存中..." : submitLabel}
      </Button>
    </form>
  );
}
