"use client";

import { useEffect, useMemo, useState } from "react";

type SignalRow = {
  id: string;
  signal_date: string;
  topic: string;
  signal_type: string;
  signal_strength: number;
  hypothesis: string;
};

type WatchlistRow = {
  signal_event_id: string;
  symbol: string;
  company_name: string;
  market: string;
};

type OutcomeRow = {
  signal_event_id: string;
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: string;
};

type ReportResponse = {
  ok: boolean;
  error?: string;
  summary: {
    signalCount: number;
    validatedOutcomeCount: number;
    successRate: number;
    averageBasketReturn: number;
    averageExcessReturn: number;
  } | null;
  signals: SignalRow[];
  watchlists: WatchlistRow[];
  outcomes: OutcomeRow[];
};

function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${Number(value).toFixed(2)}%`;
}

const monthLabels: Record<string, string> = {
  "03": "March Signal",
  "04": "April Signal",
  "05": "May Signal",
  "06": "June Validation",
};

export default function SignalValidationReportPage() {
  const [data, setData] = useState<ReportResponse | null>(null);

  useEffect(() => {
    fetch("/api/reports/signal-validation")
      .then((response) => response.json())
      .then((payload: ReportResponse) => setData(payload))
      .catch((error: Error) => setData({ ok: false, error: error.message, summary: null, signals: [], watchlists: [], outcomes: [] }));
  }, []);

  const bySignal = useMemo(() => {
    const watchlists = new Map<string, WatchlistRow[]>();
    const outcomes = new Map<string, OutcomeRow[]>();
    for (const row of data?.watchlists ?? []) watchlists.set(row.signal_event_id, [...(watchlists.get(row.signal_event_id) ?? []), row]);
    for (const row of data?.outcomes ?? []) outcomes.set(row.signal_event_id, [...(outcomes.get(row.signal_event_id) ?? []), row]);
    return { watchlists, outcomes };
  }, [data]);

  const monthSections = useMemo(() => {
    const sections = new Map<string, SignalRow[]>();
    for (const signal of data?.signals ?? []) {
      const month = signal.signal_date.slice(5, 7);
      sections.set(month, [...(sections.get(month) ?? []), signal]);
    }
    return sections;
  }, [data?.signals]);

  const signals = data?.signals ?? [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <section className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-300">AI-Native Market Signal Engine</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">TrendRadar Signal Validation Report</h1>
        <p className="mt-4 text-2xl font-bold text-slate-200">March-June 2026</p>
      </section>

      {data?.error ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{data.error}</div> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="text-sm font-bold text-slate-500">Signals</div><div className="mt-2 text-4xl font-black">{data?.summary?.signalCount ?? signals.length}</div></div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="text-sm font-bold text-slate-500">Validated Outcomes</div><div className="mt-2 text-4xl font-black">{data?.summary?.validatedOutcomeCount ?? 0}</div></div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="text-sm font-bold text-slate-500">Success Rate</div><div className="mt-2 text-4xl font-black">{pct(data?.summary?.successRate)}</div></div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="text-sm font-bold text-slate-500">Avg Excess Return</div><div className="mt-2 text-4xl font-black">{pct(data?.summary?.averageExcessReturn)}</div></div>
      </section>

      <section className="mt-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-3xl font-black">1. Executive Summary</h2>
        <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-700">TrendRadar 將新聞、價格、供應鏈與企業行動轉換成可驗證的市場訊號。這份報告呈現 Signal Ledger、watchlist 與後續報酬驗證，用來檢查訊號是否具備投資研究價值。</p>
      </section>

      <section className="mt-6 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-3xl font-black">2. Methodology</h2>
        <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-700">Time Machine Simulation：每個 signal 只能使用 as_of_date 之前的資料產生。as_of_date 之後的資料只能用於 outcome validation，避免把未來資訊混入訊號形成階段。</p>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 px-8 py-6"><h2 className="text-3xl font-black">3. Signal Ledger</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-6 py-4">Signal Date</th>
                <th className="px-6 py-4">Topic</th>
                <th className="px-6 py-4">Signal Type</th>
                <th className="px-6 py-4">Strength</th>
                <th className="px-6 py-4">Watchlist</th>
                <th className="px-6 py-4">30D Basket Return</th>
                <th className="px-6 py-4">30D Excess Return</th>
                <th className="px-6 py-4">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((signal) => {
                const outcome30 = bySignal.outcomes.get(signal.id)?.find((row) => row.horizon_days === 30);
                return (
                  <tr key={signal.id} className="border-t border-slate-100">
                    <td className="px-6 py-4 font-bold">{signal.signal_date}</td>
                    <td className="px-6 py-4 font-black">{signal.topic}</td>
                    <td className="px-6 py-4">{signal.signal_type}</td>
                    <td className="px-6 py-4">{signal.signal_strength}</td>
                    <td className="px-6 py-4">{bySignal.watchlists.get(signal.id)?.length ?? 0}</td>
                    <td className="px-6 py-4">{pct(outcome30?.basket_return)}</td>
                    <td className="px-6 py-4">{pct(outcome30?.excess_return)}</td>
                    <td className="px-6 py-4 capitalize">{outcome30?.outcome ?? "pending"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {["03", "04", "05"].map((month, index) => (
        <section key={month} className="mt-6 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-3xl font-black">{index + 4}. {monthLabels[month]}</h2>
          <div className="mt-5 space-y-6">
            {(monthSections.get(month) ?? []).map((signal) => (
              <div key={signal.id} className="rounded-2xl bg-slate-50 p-5">
                <h3 className="text-2xl font-black">{signal.topic}</h3>
                <p className="mt-3 leading-7 text-slate-700">{signal.hypothesis}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(bySignal.watchlists.get(signal.id) ?? []).map((item) => <span key={`${signal.id}-${item.symbol}`} className="rounded-full bg-white px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200">{item.company_name || item.symbol}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-6 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-3xl font-black">7. June Validation</h2>
        <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-700">整理三、四、五月 signal 的驗證結果。30D 與 60D outcome 用來判斷訊號是否具備延續性；pending 代表目前缺少股價資料或尚未匯入 benchmark。</p>
      </section>

      <section className="mt-6 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-3xl font-black">8. Conclusion</h2>
        <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-700">TrendRadar 的價值不是 AI 摘要，而是可驗證的 Signal Ledger。第一版先用 CSV、rule-based watchlist 與手動 seed signals 建立閉環，後續再接 AI 命名、真實資料源與更嚴格的 validation。</p>
      </section>
    </main>
  );
}
