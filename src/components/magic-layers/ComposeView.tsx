"use client";
/* ============================================================
   Magic Layers — 編輯器落地頁

   只負責把「怎麼進來的」變成一張畫布，然後交給編輯器：
     ?blank=1      空白畫布（首頁「自由設計 → 空白開始」）
     ?seed=1       自由排版精靈已經 compose 好的圖層（sessionStorage 交棒）
     ?activity=id  續編已存的草稿（?layout=id 是舊網址）

   這裡本來還有一張「分層合成」表單（背景三選一＋產品圖＋標題副標），
   已經被首頁的自由排版精靈完整取代——精靈同樣有素材庫／上傳／AI 背景、
   產品圖自動去背、標題副標，還多了空白起手式與 AI 底圖預覽重生。
   表單最後一個入口（素材庫「用這張做背景排版」）也早就拿掉了，
   只剩手打網址才碰得到，打開會讓人以為走錯站，所以移除；沒帶上面任何
   參數進來就轉回品牌首頁。舊表單在 git 記錄裡（移除前最後一版 fc497d1）。

   Renders INSIDE the app shell (<main>), so the brand sidebar stays visible.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MagicLayersEditor, type SavedLayer, type SavedPage } from "@/components/magic-layers/MagicLayersEditor.tsx";
import { savedToLayerData } from "@/lib/magic-layers/saved-layer.ts";
import { imageSetSubtypeLabel } from "@/lib/products/image-set-subtype-labels";
import type { LayerData } from "@/lib/magic-layers/types.ts";
import { ML_COMPOSE_CLIENT_KEY, ML_WIZARD_SEED_KEY } from "@/components/activities/RolePickerModal";
import { buildAssetKitSeedLayers, parseMagicLayersSeed, type HandoffKitAsset } from "@/lib/products/asset-kit-handoff";

// 造一張 docW×docH 的空白圖，只用來給編輯器決定畫布尺寸（圖層自己帶各自的圖）。
function blankImage(w: number, h: number): Promise<HTMLImageElement> {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = c.toDataURL("image/png"); });
}

export function ComposeView({ clientId: clientIdProp }: { clientId?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // clientId：品牌路由用 prop（會被側邊欄高亮）；獨立頁退回 sessionStorage handoff。
  const [clientId, setClientId] = useState<string | null>(clientIdProp ?? null);
  const [title, setTitle] = useState("");
  /** 多頁草稿的第 2 頁以後（第 1 頁照舊用 layers／img）。 */
  const [extraPages, setExtraPages] = useState<SavedPage[] | undefined>(undefined);   // 精靈帶進來的標題，存檔時當預設設計名稱
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [layers, setLayers] = useState<LayerData[] | null>(null);
  const [bgLibrary, setBgLibrary] = useState<{ url: string; label?: string }[]>([]);
  const [kitLibrary, setKitLibrary] = useState<{ url: string; label?: string }[]>([]);
  const [activityId, setActivityId] = useState<string | null>(null); // 已存草稿活動 id → 之後儲存變更新同一筆
  const [docName, setDocName] = useState<string | null>(null);       // 設計名稱（可重新命名）
  const [logos, setLogos] = useState<string[]>([]);                  // 品牌 logo（Logo 工具用）

  // 獨立的 /magic-layers/compose 路由沒有品牌參數 → 從交棒的 sessionStorage 接手 clientId。
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const cid = sessionStorage.getItem(ML_COMPOSE_CLIENT_KEY);
        if (cid) { sessionStorage.removeItem(ML_COMPOSE_CLIENT_KEY); if (!clientIdProp) setClientId(cid); }
      } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [clientIdProp]);

  // 沒東西可開時的去處。以前這些失敗路徑會掉回舊的分層合成表單，表單移除後
  // 要是不轉走，使用者就會停在一片空白上。
  const backToBrand = useCallback(() => {
    router.replace(clientIdProp ? `/clients/${clientIdProp}` : "/clients");
  }, [router, clientIdProp]);

  // 沒帶任何入口參數 → 沒有東西可以開，轉回品牌首頁（自由排版的入口在那張「自由設計」卡片）。
  useEffect(() => {
    const sp = searchParams;
    if (sp.get("blank") === "1" || sp.get("seed") === "1" || sp.get("activity") || sp.get("layout")) return;
    backToBrand();
  }, [searchParams, backToBrand]);

  // 首頁「自由排版」帶 ?blank=1 → 跳過表單，直接開一張空白畫布進編輯器。
  useEffect(() => {
    if (searchParams.get("blank") !== "1") return;
    let cancelled = false;
    (async () => {
      const cid = searchParams.get("clientId");
      if (cid && !clientIdProp) setClientId(cid);
      const im = await blankImage(1200, 1200);
      if (cancelled) return;
      setImg(im);
      setLayers([]);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // [自由排版精靈] 網址帶 ?seed=1 → 讀 sessionStorage 已 compose 好嘅 layers/尺寸，直接落地編輯器。
  useEffect(() => {
    if (searchParams.get("seed") !== "1") return;
    let cancelled = false;
    (async () => {
      try {
        const raw = sessionStorage.getItem(ML_WIZARD_SEED_KEY);
        if (!raw) { backToBrand(); return; }
        const seed = parseMagicLayersSeed(raw);
        if (!seed) { backToBrand(); return; }
        let seedLayers = seed.layers;
        if (seed.assetKit) {
          const seedClientId = seed.clientId ?? clientIdProp;
          if (!seedClientId) { backToBrand(); return; }
          const response = await fetch(`/api/products/${encodeURIComponent(seed.assetKit.productId)}/image-set/${encodeURIComponent(seed.assetKit.batchId)}?clientId=${encodeURIComponent(seedClientId)}`);
          const kit = await response.json().catch(() => ({})) as { productId?: unknown; batchId?: unknown; assets?: HandoffKitAsset[] };
          if (!response.ok || kit.productId !== seed.assetKit.productId || kit.batchId !== seed.assetKit.batchId || !Array.isArray(kit.assets)) { backToBrand(); return; }
          const allowed = new Set(seed.assetKit.assetIds);
          const assets = kit.assets.filter((asset) => allowed.has(asset.id) && asset.status === "DONE" && !!asset.imageUrl);
          seedLayers = buildAssetKitSeedLayers(assets, seed.docW, seed.docH);
          setKitLibrary(assets.map((asset) => ({ url: asset.imageUrl, label: asset.assetSubtype ? imageSetSubtypeLabel(asset.assetSubtype).zh : "視覺套組素材" })));
        }
        const im = await blankImage(seed.docW, seed.docH);
        if (cancelled) return;
        setImg(im);
        setLayers(seedLayers);
          if (seed.clientId && !clientIdProp) setClientId(seed.clientId);
        if (seed.title) { setTitle(seed.title); setDocName(seed.title); }
        sessionStorage.removeItem(ML_WIZARD_SEED_KEY);
      } catch { backToBrand(); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 續編：網址帶 ?activity=<id>（草稿活動）或舊的 ?layout=<libraryImageId>
  // → 抓已存排版、還原成 LayerData[] + 空白尺寸圖 → 直接進編輯器。
  useEffect(() => {
    let cancelled = false;
    let q = "";
    try {
      const sp = new URLSearchParams(window.location.search);
      const a = sp.get("activity"); const l = sp.get("layout");
      if (a) q = `activity=${encodeURIComponent(a)}`; else if (l) q = `id=${encodeURIComponent(l)}`;
    } catch { /* ignore */ }
    if (!q) return;
    (async () => {
      try {
        const r = await fetch(`/api/magic-layers/save?${q}`);
        const d = await r.json();
        if (cancelled) return;
        if (!r.ok) { backToBrand(); return; }
        const im = await blankImage(d.docW, d.docH);
        if (cancelled) return;
        setImg(im);
        setLayers((d.layers as SavedLayer[]).map(savedToLayerData));
        if (Array.isArray(d.pages) && d.pages.length > 1) setExtraPages((d.pages as SavedPage[]).slice(1));
          if (d.activityId) setActivityId(d.activityId);
        if (d.name) { setTitle(d.name); setDocName(d.name); }
      } catch { backToBrand(); }
    })();
    return () => { cancelled = true; };
  }, [backToBrand]);

  // 素材庫縮圖清單連動該品牌素材庫（有 clientId 讀 gallery，否則退回全域 + 樣本）。
  useEffect(() => {
    let ignore = false;
    const apply = (list: { url: string; label?: string }[]) => { if (!ignore) setBgLibrary(list); };
    const samples = [{ url: "/ml-socie.jpg", label: "樣本背景 A" }, { url: "/ml-hero.PNG", label: "樣本背景 B" }];
    if (clientId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetch(`/api/library/gallery?clientId=${encodeURIComponent(clientId)}`).then((r) => r.json()).then((items: any[]) => {
        apply((Array.isArray(items) ? items : [])
          .filter((it) => it?.imageUrl && (it.kind !== "generated" || it.status === "DONE"))
          .map((it) => ({ url: it.imageUrl as string, label: (it.name || it.subject || it.prompt?.slice?.(0, 18) || "") as string }))
          .slice(0, 80));
      }).catch(() => apply([]));
    } else {
      fetch("/api/magic-layers/backgrounds").then((r) => r.json()).then((d) => {
        const list = (d.backgrounds ?? []) as { url: string; label?: string }[];
        apply(list.length ? list : samples);
      }).catch(() => apply(samples));
    }
    return () => { ignore = true; };
  }, [clientId]);

  // 品牌 logo（給編輯器「Logo」工具插入用）
  useEffect(() => {
    if (!clientId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetch(`/api/clients/${clientId}`).then((r) => r.json()).then((c: any) => {
      const arr: string[] = [];
      const many = c?.logoUrls;  // 多版本（若 schema 有）
      if (Array.isArray(many)) arr.push(...many);
      else if (typeof many === "string" && many) { try { arr.push(...JSON.parse(many)); } catch { arr.push(many); } }
      if (typeof c?.logoUrl === "string" && c.logoUrl) arr.push(c.logoUrl);  // 單一 logo（此 schema 的欄位）
      setLogos([...new Set(arr.filter(Boolean))]);
    }).catch(() => { /* ignore */ });
  }, [clientId]);

  const availableBackgrounds = [...kitLibrary, ...bgLibrary.filter((item) => !kitLibrary.some(({ url }) => url === item.url))];

  // 儲存 / 下載：壓平圖 + 圖層 JSON → 存進素材庫（第一次新增、之後更新同一筆）。
  const handleSave = useCallback(async (payload: { docW: number; docH: number; layers: SavedLayer[]; imageDataUrl: string; finalize: boolean; pages?: SavedPage[]; pageImages?: string[] }) => {
    const r = await fetch("/api/magic-layers/save", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, activityId, name: (docName ?? title).trim() || "未命名排版", ...payload }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? r.statusText);
    if (d.activityId) setActivityId(d.activityId);
  }, [clientId, activityId, docName, title]);

  // 編輯器：填滿 <main> 內容區（圓角面板），品牌側邊欄仍在左側。
  if (layers && img) {
    return (
      <div style={S.editorPanel}>
        <MagicLayersEditor image={img} layers={layers} backgrounds={availableBackgrounds} logos={logos}
          name={docName ?? title} clientId={clientId} onRename={setDocName}
          onBack={() => router.back()} onSave={handleSave} extraPages={extraPages} />
      </div>
    );
  }

  return null;   // 轉址途中（或畫布還在準備），不要閃過任何畫面
}

const S: Record<string, React.CSSProperties> = {
  // 填滿有內距的 <main> 內容區（不用 fixed 蓋版，側邊欄才留得住）
  editorPanel: { height: "100%", overflow: "hidden", background: "#fff" },
};
