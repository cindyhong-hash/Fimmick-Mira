"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, Download, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type { ImageSetArtDirection } from "@/lib/products/product-visual-analysis";
import type { ImageSetCategory, ImageSetPlanItem } from "@/lib/products/image-set-kit";
import { buildAssetKitSelection, groupVisualAssetBoardAssets, visualAssetBoardCounts } from "@/lib/products/visual-asset-board";

type BoardAsset = {
  id: string;
  category: ImageSetCategory | null;
  assetRole: string | null;
  assetSubtype: string | null;
  subject?: string | null;
  status: "PENDING" | "GENERATING" | "DONE" | "FAILED";
  imageUrl: string;
  errorMessage: string | null;
  hasTransparentBackground: boolean | null;
};

type BoardData = {
  batchId: string;
  productId: string;
  status: string;
  theme: { key: string; label: string | null } | null;
  artDirection: ImageSetArtDirection;
  plan: ImageSetPlanItem[];
  assets: BoardAsset[];
};

const CATEGORY_LABELS: Record<ImageSetCategory, string> = {
  product: "商品主體",
  texture: "質地與細節",
  background: "背景",
  benefit: "賣點視覺",
  decoration: "裝飾與版型元素",
};

export function VisualAssetBoard({ clientId, productId, batchId, productName }: {
  clientId: string;
  productId: string;
  batchId: string;
  productName: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/products/${productId}/image-set/${batchId}`);
      const payload = await response.json().catch(() => ({})) as BoardData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "無法載入視覺套組");
      setData(payload);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法載入視覺套組");
    } finally {
      setLoading(false);
    }
  }, [batchId, productId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(frame);
  }, [load]);
  useEffect(() => {
    if (!data?.assets.some(({ status }) => status === "PENDING" || status === "GENERATING")) return;
    const timer = setInterval(() => { void load(); }, 2_000);
    return () => clearInterval(timer);
  }, [data, load]);

  const groups = useMemo(() => groupVisualAssetBoardAssets(data?.assets ?? []), [data]);
  const counts = visualAssetBoardCounts(data?.assets ?? []);
  const selection = buildAssetKitSelection({ clientId, productId, batchId, assets: data?.assets ?? [] });
  const previewAssets = (data?.assets ?? []).filter(({ status, imageUrl }) => status === "DONE" && imageUrl).slice(0, 5);

  const retry = async (asset: BoardAsset) => {
    setBusyId(asset.id);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}/image-set/${batchId}/assets/${asset.id}/retry`, { method: "POST" });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "無法重新產生素材");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法重新產生素材");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (asset: BoardAsset) => {
    if (!window.confirm(`確定刪除「${asset.assetSubtype ?? asset.subject ?? "這張素材"}」？`)) return;
    setBusyId(asset.id);
    try {
      const response = await fetch(`/api/library/images/${asset.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("刪除失敗");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "刪除失敗");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="flex min-h-72 items-center justify-center text-sm text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />載入視覺套組…</div>;

  return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
    <button type="button" onClick={() => router.push(`/clients/${clientId}/products/${productId}`)} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4" />返回產品</button>
    <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600">Visual Asset Kit</p><h1 className="mt-1 text-2xl font-bold text-gray-950 sm:text-3xl">{productName} 視覺套組</h1><p className="mt-2 text-sm text-gray-500">{data?.theme?.label ?? "常態品牌素材"} · {counts.done}/{counts.total} 張完成</p></div>
      <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">完成 {counts.done}</span>{counts.active > 0 && <span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-700">處理中 {counts.active}</span>}{counts.failed > 0 && <span className="rounded-full bg-red-50 px-3 py-1.5 text-red-700">失敗 {counts.failed}</span>}</div>
    </header>
    {error && <div role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

    <section className="mt-7 overflow-hidden rounded-3xl border border-[#e7ebf1] bg-[#f7f7fb] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold text-gray-900">套組預覽</h2><p className="mt-1 text-xs text-gray-500">此處由現有縮圖即時組合，不會另存成素材。</p></div><span className="text-xs text-gray-400">{selection.assetIds.length} 張可用</span></div>
      {previewAssets.length ? <div className="grid min-h-64 grid-cols-2 gap-3 sm:grid-cols-4 sm:grid-rows-2">{previewAssets.map((asset, index) => <div key={asset.id} className={`overflow-hidden rounded-2xl border border-white bg-white shadow-sm ${index === 0 ? "col-span-2 row-span-2" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.imageUrl} alt={asset.subject ?? asset.assetSubtype ?? "視覺素材"} className="h-full w-full object-contain" />
      </div>)}</div> : <div className="flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-sm text-gray-400">尚無完成素材</div>}
    </section>

    <div className="mt-8 space-y-8">{(Object.keys(CATEGORY_LABELS) as ImageSetCategory[]).map((category) => {
      const assets = groups[category] ?? [];
      if (!assets.length) return null;
      return <section key={category}><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold text-gray-900">{CATEGORY_LABELS[category]}</h2><span className="text-xs text-gray-400">{assets.length} 項</span></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{assets.map((asset) => <article key={asset.id} className="overflow-hidden rounded-2xl border border-[#e7ebf1] bg-white shadow-sm">
        <div className="relative aspect-square bg-gray-50">{asset.status === "DONE" && asset.imageUrl ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.imageUrl} alt={asset.subject ?? asset.assetSubtype ?? CATEGORY_LABELS[category]} className="h-full w-full object-contain" />
          {asset.hasTransparentBackground && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-gray-600 shadow-sm">透明背景</span>}
        </> : <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-gray-500">{asset.status === "FAILED" ? <AlertCircle className="h-6 w-6 text-red-400" /> : <Loader2 className="h-6 w-6 animate-spin text-violet-500" />}{asset.status === "FAILED" ? "生成失敗" : "正在生成"}</div>}</div>
        <div className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-gray-900">{asset.assetSubtype?.replaceAll("-", " ") ?? asset.subject ?? CATEGORY_LABELS[category]}</h3><p className="mt-1 text-xs text-gray-500">{data?.plan.find((item) => item.assetRole === asset.assetRole && item.assetSubtype === asset.assetSubtype)?.purpose ?? asset.errorMessage ?? "視覺套組素材"}</p></div>{asset.status === "DONE" && <Check className="h-4 w-4 shrink-0 text-emerald-500" />}</div>
          <div className="mt-4 flex flex-wrap gap-2">{asset.status === "DONE" && asset.imageUrl && <a href={asset.imageUrl} download className="inline-flex items-center gap-1 rounded-lg border border-[#e5e9f0] px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"><Download className="h-3.5 w-3.5" />下載</a>}{asset.status === "FAILED" && <button type="button" onClick={() => void retry(asset)} disabled={busyId === asset.id} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${busyId === asset.id ? "animate-spin" : ""}`} />重新產生</button>}<button type="button" onClick={() => void remove(asset)} disabled={busyId === asset.id} className="inline-flex items-center gap-1 rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />刪除</button></div>
        </div>
      </article>)}</div></section>;
    })}</div>
  </div>;
}
