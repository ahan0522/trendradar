"use client";

import { useState } from "react";

export function SubscribeButton({ userId, email }: { userId: string; email: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        setError(payload.error ?? "訂閱功能尚未開放。");
        return;
      }
      window.location.href = payload.url;
    } catch {
      setError("無法連線到付款服務，請稍後再試。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={pending}
        className="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "處理中…" : "訂閱"}
      </button>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
