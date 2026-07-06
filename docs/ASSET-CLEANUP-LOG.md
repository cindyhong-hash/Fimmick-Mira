# 素材清理 / 隔離記錄（內部）

> 記錄「未採用素材」由 `public/uploads/` 移去隔離資料夾嘅操作 + **還原指令**。
> 工具：`scripts/move-unused-assets.mjs`（dry-run 預設，`--apply` 先真移）。
> 只讀清單：`npm run unused-assets` → `docs/UNUSED-ASSETS.md`（自動生成，勿手改）。

---

## 界定：咩叫「未採用」
`clientId = null` 嘅 `LibraryImage` / `StyleComponent` 所引用嘅 `/uploads/` 檔（已喺所有品牌工作區隱藏，只喺 `/unassigned` 頁見到）。
移走時**會自動排除共用檔**——若同一實體檔亦被任何在用記錄引用（有品牌嘅 image/component、client logo/pastPost、活動 產品圖/參考圖、layout 圖），就唔郁，避免整爛在用圖。
**移走只郁檔，唔改 DB**（`clientId=null` 記錄仍在，`/unassigned` 縮圖會 404 直到還原）。

---

## 常用指令

```bash
# 1) 睇會移咩（唔郁任何嘢）
node scripts/move-unused-assets.mjs

# 2) 真正移走到 .backup/unused-<日期>/
node scripts/move-unused-assets.mjs --apply

# 3) 更新只讀清單
npm run unused-assets
```

### 🔙 還原指令（萬一要攞返）
將隔離資料夾嘅檔複製返入 `public/uploads/`：
```bash
# 對應下面記錄嘅日期換 <日期>
cp -R .backup/unused-<日期>/public/uploads/. public/uploads/
```

---

## 操作記錄

### 2026-07-06 · 移走 101 檔 / 171.3 MB
- 指令：`node scripts/move-unused-assets.mjs --apply`
- 移去：`.backup/unused-2026-07-06/`
- 效果：`public/uploads/` **445 MB → 274 MB**（281 檔）
- 保護：自動排除 **1 個共用檔** `7fd4c163-cebe-45ec-bfd0-56c169a6d6d2.jpg`
- DB：未改（可完全還原）
- 驗證：在用圖庫無爛（gallery API 76 張、抽查檔案齊、0 broken）
- **還原**：
  ```bash
  cp -R .backup/unused-2026-07-06/public/uploads/. public/uploads/
  ```

<!-- 之後每次 --apply 喺上面加一段記錄 -->
</content>
