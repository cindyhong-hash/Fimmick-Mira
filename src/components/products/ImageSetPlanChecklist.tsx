"use client";

import { Check, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { ImageSetPlanSelection } from "@/lib/products/image-set-ui";
import { imageSetSubtypeLabel } from "@/lib/products/image-set-subtype-labels";

const CATEGORY_LABELS: Record<ImageSetPlanSelection["category"], string> = {
  product: "商品主體",
  texture: "質地與細節",
  background: "背景",
  benefit: "賣點視覺",
  decoration: "裝飾與版型元素",
};

/** 跟提示詞那邊的上限一致：標題 8 字、說明 16 字。 */
const BENEFIT_TITLE_MAX = 8;
const BENEFIT_DESCRIPTION_MAX = 16;

export function ImageSetPlanChecklist({ items, maxAssets, onToggle, onEditBenefitText, benefitIconStyleControl }: {
  items: ImageSetPlanSelection[];
  maxAssets: number;
  onToggle: (id: string) => void;
  /** AI 抓的賣點不一定對，所以標題與說明都可以就地改。 */
  onEditBenefitText?: (id: string, field: "benefitTitle" | "benefitDescription", value: string) => void;
  /** 賣點圖示的風格選擇；就近接在那幾個項目下面，勾選時才需要決定。 */
  benefitIconStyleControl?: ReactNode;
}) {
  const selectedCount = items.filter(({ checked }) => checked).length;
  // 賣點圖示自成一區：混在「賣點視覺」那一組裡，跟功效視覺長得一模一樣，
  // 看不出它們是一組可挑選的 icon。
  const isBenefitIcon = (item: ImageSetPlanSelection) => item.assetSubtype.startsWith("benefit-icon");
  const benefitIcons = items.filter(isBenefitIcon);
  const groups = Object.entries(CATEGORY_LABELS).map(([category, label]) => ({
    category: category as ImageSetPlanSelection["category"],
    label,
    items: items.filter((item) => item.category === category && !isBenefitIcon(item)),
  })).filter((group) => group.items.length);

  return <div>
    <div className="mb-3 flex items-end justify-between gap-3">
      <div><h3 className="text-sm font-bold text-gray-900">確認要生成的素材</h3><p className="mt-1 text-xs text-gray-500">核心 5 項已預選；額外變化由你決定是否加入。</p></div>
      <span className="shrink-0 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">已選 {selectedCount}/{maxAssets}</span>
    </div>
    <div className="space-y-4">{groups.map((group) => <section key={group.category} aria-labelledby={`kit-${group.category}`}>
      <h4 id={`kit-${group.category}`} className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">{group.label}</h4>
      <div className="space-y-2">{group.items.map((item) => {
        const disabled = !item.checked && selectedCount >= maxAssets;
        // 視覺層級：中文名稱 > 核心標籤 > 英文輔助名稱 > 說明。
        // 英文保留給熟悉原始類型的人對照，但不再當主要閱讀內容。
        const subtypeLabel = imageSetSubtypeLabel(item.assetSubtype);
        // 賣點圖示四張的子型別名稱一模一樣（都叫「賣點圖示」），得往下讀小字才分得出
        // 誰是誰。改成主標題直接顯示賣點名稱，「Benefit Icon」降成次標。
        // 是不是賣點圖示看 assetSubtype，不要看標題有沒有字——標題可以被清空，
        // 用空字串當判斷會讓那一列在清空的瞬間變回不可編輯，就再也打不了字。
        const isBenefitIcon = item.assetSubtype.startsWith("benefit-icon");
        const label = isBenefitIcon && item.benefitTitle
          ? { zh: item.benefitTitle, en: subtypeLabel.en, description: item.benefitDescription ?? "" }
          : subtypeLabel;
        const rowClass = `flex items-start gap-3 rounded-xl border p-3.5 transition ${item.checked ? "border-violet-500 bg-violet-50" : "border-[#e7ebf1] bg-white hover:border-violet-300"} ${disabled ? "opacity-45" : ""}`;
        const box = <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${item.checked ? "border-violet-600 bg-violet-600 text-white" : "border-gray-300 bg-white"}`}>{item.checked && <Check className="h-3.5 w-3.5" />}</span>;

        // 賣點圖示的文字是可編輯的，所以整列不能是 <label>——點輸入框會連帶
        // 切換勾選。改成勾選框自己是一顆按鈕，文字區塊獨立。
        if (isBenefitIcon && onEditBenefitText) {
          const blankTitle = !(item.benefitTitle ?? "").trim();
          return <div key={item.id} className={rowClass}>
            <button
              type="button"
              role="checkbox"
              aria-checked={item.checked}
              aria-label={`選擇「${item.benefitTitle}」`}
              disabled={disabled}
              onClick={() => onToggle(item.id)}
              className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
            >{box}</button>
            <span className="min-w-0 flex-1">
              <input
                value={item.benefitTitle ?? ""}
                maxLength={BENEFIT_TITLE_MAX}
                aria-label="賣點標題"
                aria-invalid={blankTitle && item.checked}
                placeholder="賣點標題"
                onChange={(event) => onEditBenefitText(item.id, "benefitTitle", event.target.value)}
                className={`w-full rounded-md border bg-transparent px-1.5 py-0.5 text-sm font-bold text-gray-900 outline-none focus:bg-white ${blankTitle && item.checked ? "border-red-300 focus:border-red-400" : "border-transparent hover:border-[#e5e9f0] focus:border-violet-400"}`}
              />
              <span className="mt-0.5 block px-1.5 text-[11px] leading-4 text-gray-400">
                {blankTitle && item.checked ? <span className="text-red-500">標題不能留空，這是 icon 要畫的內容</span> : label.en}
              </span>
              <input
                value={item.benefitDescription ?? ""}
                maxLength={BENEFIT_DESCRIPTION_MAX}
                aria-label="賣點說明"
                placeholder="補充說明（可留空）"
                onChange={(event) => onEditBenefitText(item.id, "benefitDescription", event.target.value)}
                className="mt-1 w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs leading-5 text-gray-500 outline-none placeholder:text-gray-300 hover:border-[#e5e9f0] focus:border-violet-400 focus:bg-white"
              />
            </span>
          </div>;
        }

        return <label key={item.id} className={`${rowClass} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
          <input className="sr-only" type="checkbox" checked={item.checked} disabled={disabled} onChange={() => onToggle(item.id)} />
          {box}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-900">{label.zh}{item.core && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-violet-600">核心</span>}</span>
            {label.en && <span className="mt-0.5 block text-[11px] leading-4 text-gray-400">{label.en}</span>}
            <span className="mt-1 block text-xs leading-5 text-gray-500">{label.description || (item.benefitTitle ? "" : item.purpose)}</span>
          </span>
        </label>;
      })}</div>
    </section>)}</div>

    {!!benefitIcons.length && (
      <section aria-labelledby="kit-benefit-icons" className="mt-6 rounded-2xl border border-[#e7ebf1] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50"><Sparkles className="h-4 w-4 text-violet-600" /></span>
            <h4 id="kit-benefit-icons" className="text-sm font-bold text-gray-900">AI 推薦賣點 Icon</h4>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-600">AI 推薦</span>
          </div>
          <span className="text-xs font-bold text-gray-500">
            已選 <span className="text-violet-700">{benefitIcons.filter(({ checked }) => checked).length}</span> / {benefitIcons.length}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-gray-500">AI 已依商品推薦賣點，你可以修改名稱或取消不需要的項目。</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {benefitIcons.map((item) => {
            const disabled = !item.checked && selectedCount >= maxAssets;
            const blankTitle = !(item.benefitTitle ?? "").trim();
            return <div
              key={item.id}
              className={`rounded-xl border p-3.5 transition ${item.checked ? "border-violet-400 bg-violet-50/50" : "border-[#e7ebf1] bg-white"} ${disabled ? "opacity-45" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1">
                  {onEditBenefitText ? <input
                    value={item.benefitTitle ?? ""}
                    maxLength={BENEFIT_TITLE_MAX}
                    aria-label="賣點標題"
                    aria-invalid={blankTitle && item.checked}
                    placeholder="賣點標題"
                    onChange={(event) => onEditBenefitText(item.id, "benefitTitle", event.target.value)}
                    className={`w-full rounded-md border bg-transparent px-1.5 py-0.5 text-sm font-bold text-gray-900 outline-none focus:bg-white ${blankTitle && item.checked ? "border-red-300 focus:border-red-400" : "border-transparent hover:border-[#e5e9f0] focus:border-violet-400"}`}
                  /> : <span className="block px-1.5 text-sm font-bold text-gray-900">{item.benefitTitle}</span>}
                </span>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.checked}
                  aria-label={`選擇「${item.benefitTitle ?? "賣點圖示"}」`}
                  disabled={disabled}
                  onClick={() => onToggle(item.id)}
                  className={`mt-0.5 shrink-0 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${item.checked ? "border-violet-600 bg-violet-600 text-white" : "border-gray-300 bg-white"}`}>{item.checked && <Check className="h-3.5 w-3.5" />}</span>
                </button>
              </div>
              {onEditBenefitText ? <input
                value={item.benefitDescription ?? ""}
                maxLength={BENEFIT_DESCRIPTION_MAX}
                aria-label="賣點說明"
                placeholder="補充說明（可留空）"
                onChange={(event) => onEditBenefitText(item.id, "benefitDescription", event.target.value)}
                className="mt-1 w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs leading-5 text-gray-500 outline-none placeholder:text-gray-300 hover:border-[#e5e9f0] focus:border-violet-400 focus:bg-white"
              /> : <span className="mt-1 block px-1.5 text-xs leading-5 text-gray-500">{item.benefitDescription}</span>}
              {blankTitle && item.checked && <span className="mt-1 block px-1.5 text-[11px] leading-4 text-red-500">標題不能留空，這是 icon 要畫的內容</span>}
            </div>;
          })}
        </div>

        {benefitIconStyleControl}
      </section>
    )}
  </div>;
}
