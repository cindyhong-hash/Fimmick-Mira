"use client";
import { useEffect, useState } from "react";

/**
 * useRotatingHint — loading 期間輪播進度提示（例：「正在生成 AI 素材…」→「分析構圖/配色…」）。
 * 保留呼叫方原本嘅時間估計（例「約 10–40 秒」），只係額外俾用戶知道進度，等佢有耐性。
 * active 變 false 會 reset 返第一句。
 */
export function useRotatingHint(active: boolean, messages: string[], intervalMs = 2600): string {
  const [i, setI] = useState(0);
  const rotating = active && messages.length > 1;

  // 開始／停止輪播嗰陣 reset 返第一句。用 React 官方「render 期間比較 prev state 調整
  // state」寫法，唔喺 effect 入面同步 setI(0)（react-hooks/set-state-in-effect）。
  const [prevRotating, setPrevRotating] = useState(rotating);
  if (prevRotating !== rotating) { setPrevRotating(rotating); setI(0); }

  useEffect(() => {
    if (!rotating) return;
    const t = setInterval(() => setI((v) => (v + 1) % messages.length), intervalMs);
    return () => clearInterval(t);
  }, [rotating, messages.length, intervalMs]);
  return messages[Math.min(i, messages.length - 1)] ?? "";
}
