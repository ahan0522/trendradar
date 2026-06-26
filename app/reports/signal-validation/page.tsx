"use client";

import Link from "next/link";
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
  if (value === null || value === undefined) return "待驗證";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

const monthLabels: Record<string, string> = {
  "03": "三月訊號",
  "04": "四月訊號",
  "05": "五月訊號",
  "06": "六月驗證",
};

export default function SignalValidationReportPage() {
  const [data, setData] = useState<ReportResponse | null>(null);

  useEffect(() => {
    fetch("/api/reports/signal-validation")
      .then((response) => response.json())
      .then((payload: ReportResponse) => setData(payload))
      .catch((error: Error) => setData({ ok: false, error: error.message, summary: null, signals: [], watchlists: [], outcomes: [] }));
  }, []);

  const signals = useMemo(() => data?.signals ?? [], [data?.signals]);
  const bySignal = useMemo(() => {
    const watchlists = new Map<string, WatchlistRow[]>();
    const outcomes = new Map<string, OutcomeRow[]>();
    for (const row of data?.watchlists ?? []) watchlists.set(row.signal_event_id, [...(watchlists.get(row.signal_event_id) ?? []), row]);
    for (const row of data?.outcomes ?? []) outcomes.set(row.signal_event_id, [...(outcomes.get(row.signal_event_id) ?? []), row]);
    return { watchlists, outcomes };
  }, [data]);

  const monthSections = useMemo(() => {
    const sections = new Map<string, SignalRow[]>();
    for (const signal of signals) {
      const month = signal.signal_date.slice(5, 7);
      sections.set(month, [...(sections.get(month) ?? []), signal]);
    }
    return sections;
  }, [signals]);

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_34%),#090b13] p-6 shadow-2xl shadow-sky-950/30 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">AI 驅動市場研究平台</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">市場訊號驗證報告</h1>
              <p className="mt-4 text-xl font-bold text-zinc-300">2026 年 3 月至 6 月</p>
            </div>
            <Link href="/signals" className="rounded-full bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-sky-100">
              查看市場訊號資料庫
            </Link>
          </div>
        </section>

        {data?.error ? <div className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-200">{data.error}</div> : null}

        <section className="grid gap-3 md:grid-cols-4">
          <MetricCard label="訊號數量" value={String(data?.summary?.signalCount ?? signals.length)} tone="text-white" />
          <MetricCard label="已驗證結果" value={String(data?.summary?.validatedOutcomeCount ?? 0)} tone="text-emerald-300" />
          <MetricCard label="成功率" value={pct(data?.summary?.successRate)} tone="text-sky-300" />
          <MetricCard label="平均超額報酬" value={pct(data?.summary?.averageExcessReturn)} tone="text-amber-300" />
        </section>

        <ReportSection index="1" title="執行摘要">
          TrendRadar 將新聞、價格、供應鏈與企業行動轉換成可驗證的市場訊號。這份報告呈現 Signal Ledger、watchlist 與後續報酬驗證，用來檢查訊號是否具備投資研究價值。
        </ReportSection>

        <ReportSection index="2" title="研究方法">
          Time Machine Simulation（時間機模擬）：每個訊號只能使用 as_of_date 之前的資料產生。as_of_date 之後的資料只能用於結果驗證，避免把未來資訊混入訊號形成階段。
        </ReportSection>

        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/90">
          <div className="border-b border-zinc-800 px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">3. Signal Ledger</p>
            <h2 className="mt-2 text-2xl font-black">可驗證的市場訊號</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-zinc-900/80 text-zinc-500">
                <tr>
                  <th className="px-6 py-4">訊號日期</th>
                  <th className="px-6 py-4">主題</th>
                  <th className="px-6 py-4">類型</th>
                  <th className="px-6 py-4">強度</th>
                  <th className="px-6 py-4">觀察名單</th>
                  <th className="px-6 py-4">30日組合</th>
                  <th className="px-6 py-4">30日超額</th>
                  <th className="px-6 py-4">結果</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal) => {
                  const outcome30 = bySignal.outcomes.get(signal.id)?.find((row) => row.horizon_days === 30);
                  return (
                    <tr key={signal.id} className="border-t border-zinc-900">
                      <td className="px-6 py-4 font-mono text-zinc-400">{signal.signal_date}</td>
                      <td className="px-6 py-4 font-black text-white">{signal.topic}</td>
                      <td className="px-6 py-4 text-zinc-400">{signal.signal_type.replaceAll("_", " ")}</td>
                      <td className="px-6 py-4 font-mono font-black text-amber-300">{signal.signal_strength}</td>
                      <td className="px-6 py-4 text-zinc-300">{bySignal.watchlists.get(signal.id)?.length ?? 0}</td>
                      <td className="px-6 py-4 font-mono text-zinc-400">{pct(outcome30?.basket_return)}</td>
                      <td className="px-6 py-4 font-mono text-sky-300">{pct(outcome30?.excess_return)}</td>
                    <td className="px-6 py-4 capitalize text-zinc-300">{outcome30?.outcome ?? "pending"}</td>
                    </tr>
                  );
                })}
                {signals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-zinc-600">目前還沒有正式訊號。可先使用 topic-derived preview，或從後台產生正式 signal。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {["03", "04", "05"].map((month, index) => (
          <section key={month} className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">{index + 4}. {monthLabels[month]}</p>
            <div className="mt-5 space-y-4">
              {(monthSections.get(month) ?? []).map((signal) => (
                <Link key={signal.id} href={`/signals/${signal.id}`} className="block rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition hover:border-sky-400/50">
                  <h3 className="text-2xl font-black">{signal.topic}</h3>
                  <p className="mt-3 leading-7 text-zinc-400">{signal.hypothesis}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(bySignal.watchlists.get(signal.id) ?? []).map((item) => (
                      <span key={`${signal.id}-${item.symbol}`} className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-zinc-300">
                        {item.company_name || item.symbol}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
              {(monthSections.get(month) ?? []).length === 0 ? <p className="text-sm text-zinc-600">這個月份目前沒有訊號。</p> : null}
            </div>
          </section>
        ))}

        <ReportSection index="7" title="六月驗證">
          整理三、四、五月 signal 的驗證結果。30D 與 60D outcome 用來判斷訊號是否具備延續性；pending 代表目前缺少股價資料或尚未匯入 benchmark。
        </ReportSection>

        <ReportSection index="8" title="結論">
          TrendRadar 的價值不是 AI 摘要，而是可驗證的 Signal Ledger。第一版先用 CSV、rule-based watchlist 與手動資料建立閉環，後續再接真實資料源、AI 命名與更嚴格的 validation。
        </ReportSection>
      </div>
    </main>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function ReportSection({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">{index}. {title}</p>
      <h2 className="mt-2 text-2xl font-black">{title}</h2>
      <p className="mt-4 max-w-4xl text-base leading-8 text-zinc-400">{children}</p>
    </section>
  );
}
