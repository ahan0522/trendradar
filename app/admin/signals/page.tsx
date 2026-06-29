"use client";

import { useState } from "react";
import { AdminSecretField } from "@/components/AdminSecretField";
import type {
  SignalPublicationReview,
  SignalPublicationStatus,
} from "@/types/signals";

type SignalSummary = {
  id: string;
  topic: string;
  asOfDate: string;
  signalStrength: number;
  confidenceScore: number;
  watchlistCount: number;
};

const statusLabels: Record<SignalPublicationStatus, string> = {
  draft: "待檢查",
  reviewed: "已檢查",
  approved: "已核准",
  rejected: "已拒絕",
  published: "已發布",
};

function nextActions(status: SignalPublicationStatus) {
  if (status === "draft") return ["reviewed", "rejected"] as SignalPublicationStatus[];
  if (status === "reviewed") return ["approved", "rejected"] as SignalPublicationStatus[];
  if (status === "approved") return ["published", "rejected"] as SignalPublicationStatus[];
  if (status === "rejected") return ["draft"] as SignalPublicationStatus[];
  return [];
}

export default function AdminSignalsPage() {
  const [asOfDate, setAsOfDate] = useState("2026-06-28");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [signals, setSignals] = useState<SignalSummary[]>([]);
  const [reviews, setReviews] = useState<SignalPublicationReview[]>([]);

  const headers = {
    "Content-Type": "application/json",
    "x-admin-secret": adminSecret,
  };

  async function generateSignals() {
    setLoading("generate");
    try {
      const response = await fetch("/api/admin/signals/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ asOfDate }),
      });
      setResult(JSON.stringify(await response.json(), null, 2));
    } finally {
      setLoading("");
    }
  }

  async function loadWorkspace() {
    setLoading("load");
    try {
      const [signalResponse, reviewResponse] = await Promise.all([
        fetch("/api/signals"),
        fetch("/api/admin/signals/reviews", { headers }),
      ]);
      const signalPayload = await signalResponse.json();
      const reviewPayload = await reviewResponse.json();
      setSignals(signalPayload.signals ?? []);
      setReviews(reviewPayload.reviews ?? []);
      if (!reviewResponse.ok) setResult(JSON.stringify(reviewPayload, null, 2));
    } finally {
      setLoading("");
    }
  }

  async function evaluate(signalEventId: string) {
    setLoading(signalEventId);
    try {
      const response = await fetch("/api/admin/signals/reviews", {
        method: "POST",
        headers,
        body: JSON.stringify({ signalEventId }),
      });
      const payload = await response.json();
      setResult(JSON.stringify(payload, null, 2));
      if (response.ok) await loadWorkspace();
    } finally {
      setLoading("");
    }
  }

  async function transition(signalEventId: string, status: SignalPublicationStatus) {
    setLoading(`${signalEventId}-${status}`);
    try {
      const response = await fetch(`/api/admin/signals/reviews/${encodeURIComponent(signalEventId)}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ status, reviewedBy: "internal-admin" }),
      });
      const payload = await response.json();
      setResult(JSON.stringify(payload, null, 2));
      if (response.ok) await loadWorkspace();
    } finally {
      setLoading("");
    }
  }

  const reviewBySignal = new Map(reviews.map((review) => [review.signalEventId, review]));

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="rounded-3xl border border-sky-400/20 bg-zinc-950/90 p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Internal Research Console</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">訊號審核與發布閘門</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-400">
            候選訊號先留在內部。來源、事件深度、研究信心、訊號強度、當時可得證據與標的理由全部通過後，才能依序進入核准與發布。
          </p>
        </header>

        <AdminSecretField value={adminSecret} onChange={setAdminSecret} />

        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <h2 className="text-xl font-black">建立 Signal Ledger</h2>
            <label className="mt-4 block text-sm font-bold text-zinc-400" htmlFor="asOfDate">asOfDate</label>
            <input id="asOfDate" type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 font-bold outline-none focus:border-sky-400" />
            <button onClick={generateSignals} disabled={loading !== "" || !adminSecret} className="mt-4 w-full rounded-2xl bg-white px-5 py-3 font-black text-zinc-950 disabled:opacity-50">
              {loading === "generate" ? "產生中..." : "產生訊號"}
            </button>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">審核工作區</h2>
                <p className="mt-1 text-sm text-zinc-500">重新載入 Signal 與最新審核版本。</p>
              </div>
              <button onClick={loadWorkspace} disabled={loading !== "" || !adminSecret} className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-black disabled:opacity-50">
                {loading === "load" ? "讀取中..." : "載入工作區"}
              </button>
            </div>
            <pre className="mt-5 max-h-48 overflow-auto rounded-2xl border border-zinc-800 bg-black p-4 text-xs leading-6 text-zinc-400">{result || "執行結果會顯示在這裡。"}</pre>
          </div>
        </section>

        <section className="space-y-4">
          {signals.map((signal) => {
            const review = reviewBySignal.get(signal.id);
            const failed = review?.gateResults.filter((item) => item.required && !item.passed) ?? [];
            return (
              <article key={signal.id} className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 md:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-400">{signal.asOfDate}</span>
                      <span className="rounded-full bg-sky-400/10 px-3 py-1 text-sky-200">Strength {signal.signalStrength}</span>
                      <span className="rounded-full bg-violet-400/10 px-3 py-1 text-violet-200">Confidence {signal.confidenceScore}</span>
                      <span className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-400">{signal.watchlistCount} 檔標的</span>
                    </div>
                    <h3 className="mt-3 text-xl font-black md:text-2xl">{signal.topic}</h3>
                    {review ? (
                      <div className="mt-4">
                        <p className="text-sm font-bold text-zinc-300">
                          v{review.version} · {statusLabels[review.status]} · 品質 {review.qualityScore}
                        </p>
                        {failed.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-sm text-rose-300">
                            {failed.map((item) => <li key={item.key}>未通過：{item.label}（{item.reason}）</li>)}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-emerald-300">所有必要發布條件已通過。</p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-amber-300">尚未建立品質評估草稿。</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!review ? (
                      <button onClick={() => evaluate(signal.id)} disabled={loading !== ""} className="rounded-full bg-white px-4 py-2 text-sm font-black text-zinc-950 disabled:opacity-50">評估</button>
                    ) : (
                      nextActions(review.status).map((status) => (
                        <button
                          key={status}
                          onClick={() => transition(signal.id, status)}
                          disabled={loading !== "" || (["approved", "published"].includes(status) && !review.eligible)}
                          className={`rounded-full px-4 py-2 text-sm font-black disabled:opacity-40 ${status === "rejected" ? "border border-rose-400/40 text-rose-200" : "bg-white text-zinc-950"}`}
                        >
                          {statusLabels[status]}
                        </button>
                      ))
                    )}
                    {review ? (
                      <button onClick={() => evaluate(signal.id)} disabled={loading !== ""} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-black text-zinc-300 disabled:opacity-50">重新評估</button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
          {signals.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">輸入管理密鑰並載入工作區。</div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
