import { protectPaidRoute } from "@/lib/site-gate";
import { dailyQuota } from "@/lib/paid-quota";
import { NextResponse } from "next/server";
import { chatTextOpenRouter } from "@/lib/openrouter";

// LLM 呼叫可能超過 Vercel 的預設 10 秒上限（文案轉換）。
export const maxDuration = 60;

async function handlePost(request: Request) {
  const { copyText, instruction } = await request.json();
  if (!copyText || !instruction) {
    return NextResponse.json({ error: "copyText and instruction required" }, { status: 400 });
  }

  // 文案轉換改用 OpenRouter（prompt 內容不變，行為一致）。
  const result = await chatTextOpenRouter(
    `原始文案：\n${copyText}\n\n指令：${instruction}\n\n只回傳修改後的文案，不要加說明。`,
    300,
  );
  if (result == null) {
    return NextResponse.json({ error: "文案轉換失敗，請稍後再試" }, { status: 502 });
  }

  return NextResponse.json({ result });
}

// 會花 AI 費用：正式站沒設網站密碼時，用每日上限把關（見 src/lib/paid-quota.ts）
export const POST = protectPaidRoute(handlePost, { quota: dailyQuota("ai-text") });
