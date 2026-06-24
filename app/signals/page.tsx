"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Outcome = {
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: string;
};

type SignalRow = {
  id: string;
  signalDate: string;
  asOfDate: string;
  topic: string;
  signalType: string;
  signalStrength: number;
  confidenceScore: number;
  status: string;
  watchlistCount: number;
  bestOutcome: Outcome | null;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  signals: SignalRow[];
};

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${Number(value).toFixed(2)}%`;
}

export default function SignalsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/signals")
      .then((response) => response.json())
      .then((payload: ApiResponse) => setData(payload))
      .catch((error: Error) => setData({ ok: false, error: error.message, signals: [] }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Signal Ledger</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">TrendRadar Market Signals</h1>
          <p className="mt-3 max-w-3xl text-slate-600">把新聞、價格、供應鏈與企業行動轉換成可驗證的市場訊號。</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/signals" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white">Generate</Link>
          <Link href="/reports/signal-validation" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800">Report</Link>
        </div>
      </div>

      {loading ? <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">Loading signals...</div> : null}
      {!loading && data?.error ? <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{data.error}</div> : null}

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-9 gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm font-bold text-slate-600">
          <div>Signal Date</div>
          <div className="col-span-2">Topic</div>
          <div>Type</div>
          <div>Strength</div>
          <div>Confidence</div>
          <div>Status</div>
          <div>Watchlist</div>
          <div>Best Outcome</div>
        </div>
        {(data?.signals ?? []).map((signal) => (
          <Link key={signal.id} href={`/signals/${signal.id}`} className="grid grid-cols-9 gap-4 border-b border-slate-100 px-6 py-5 text-sm transition hover:bg-blue-50/60">
            <div className="font-semibold text-slate-700">{signal.signalDate}</div>
            <div className="col-span-2 font-black text-slate-950">{signal.topic}</div>
            <div className="capitalize text-slate-700">{signal.signalType.replaceAll("_", " ")}</div>
            <div className="font-bold text-orange-700">{signal.signalStrength}</div>
            <div className="font-bold text-blue-700">{signal.confidenceScore}</div>
            <div className="capitalize text-slate-700">{signal.status}</div>
            <div>{signal.watchlistCount}</div>
            <div className="font-bold text-slate-800">{signal.bestOutcome ? `${signal.bestOutcome.outcome} ${formatPct(signal.bestOutcome.excess_return)}` : "Pending"}</div>
          </Link>
        ))}
        {!loading && (data?.signals ?? []).length === 0 ? <div className="px-6 py-12 text-center text-slate-500">No signals yet. Run the seed script or generate signals.</div> : null}
      </section>
    </main>
  );
}
