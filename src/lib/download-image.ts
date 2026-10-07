/**
 * 在瀏覽器裡下載一張圖。
 * 本機圖片在同源 /uploads，download 屬性直接有效；但 Vercel 上圖片在 *.public.blob.vercel-storage.com（跨域），
 * 瀏覽器會無視 download 屬性直接開新分頁。所以先 fetch 成 blob:// 再下載，兩種情況都真的會下載。
 */
export async function downloadImage(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    // fetch 失敗（例如被 CORS 擋）就退回開新分頁，起碼看得到圖
    window.open(url, "_blank");
  }
}

/** 連續下載多張：瀏覽器會擋同時觸發的多個下載，每張之間要隔一點時間。 */
export async function downloadImages(files: { url: string; filename: string }[]): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    await downloadImage(files[i].url, files[i].filename);
    if (i < files.length - 1) await new Promise((r) => setTimeout(r, 300));
  }
}
