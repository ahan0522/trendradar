"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Watchlist = {
  symbol: string;
  companyName: string;
  market: string;
  thesis: string;
  weight: number;
  source: string | null;
};

type Outcome = {
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: string;
};

type StockDetail = {
  symbol: string;
  companyName: string;
  market: string;
  entryPrice: number | null;
  entryDate: string | null;
  exitPrice: number | null;
  exitDate: string | null;
  returnPct: number | null;
};

type ApiResponse = {
  ok: boolean;
  source?: string;
  error?: string;
  signal?: {
    id: string;
    signalDate: string;
    asOfDate: string;
    topic: string;
    signalType: string;
    signalStrength: number;
    confidenceScore: number;
    hypothesis: string;
    evidence: unknown[];
    status: string;
  };
  watchlists?: Watchlist[];
  outcomes?: Outcome[];
  stockReturnDetails?: Array<{ horizonDays: number; details: StockDetail[]; basketReturn: number | null }>;
};

type EvidenceMetric = {
  topic_id?: string;
  slug?: string | null;
  source?: string;
  category?: string;
  discovery_mode?: string;
  heat_score?: number;
  source_count?: number;
  article_count?: number;
};

function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function price(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(2);
}

function signalTypeLabel(value: string) {
  const labels: Record<string, string> = {
    news: "News Signal",
    price: "Price Signal",
    supply_chain: "Supply Chain",
    company_action: "Company Action",
    mixed: "Mixed Signal",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function scoreColor(score: number) {
  if (score >= 75) return "#10b981";
  if (score >= 45) return "#38bdf8";
  return "#f59e0b";
}

function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const stroke = 5;
  const radius = size / 2 - stroke - 2;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, score));

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#27272a" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={scoreColor(score)}
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
        />
      </svg>
      <div className="z-10 text-center">
        <div className="font-mono text-2xl font-black text-white">{score}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">score</div>
      </div>
    </div>
  );
}

export default function SignalDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/signals/${params.id}`)
      .then((response) => response.json())
      .then((payload: ApiResponse) => setData(payload))
      .catch((error: Error) => setData({ ok: false, error: error.message }))
      .finally(() => setLoading(false));
  }, [params.id]);

  const returnRows = useMemo(() => {
    const bySymbol = new Map<string, { symbol: string; companyName: string; market: string; entryPrice: number | null; returns: Record<number, number | null> }>();
    for (const horizon of data?.stockReturnDetails ?? []) {
      for (const detail of horizon.details) {
        const row = bySymbol.get(detail.symbol) ?? {
          symbol: detail.symbol,
          companyName: detail.companyName,
          market: detail.market,
          entryPrice: detail.entryPrice,
          returns: {},
        };
        row.returns[horizon.horizonDays] = detail.returnPct;
        bySymbol.set(detail.symbol, row);
      }
    }
    return [...bySymbol.values()];
  }, [data?.stockReturnDetails]);

  const evidence = (data?.signal?.evidence?.[0] ?? {}) as EvidenceMetric;
  const outcomes = data?.outcomes ?? [];
  const watchlists = data?.watchlists ?? [];

  if (loading) {
    return <main className="min-h-screen bg-[#05070d] px-6 py-10 text-zinc-400">Loading signal memo...</main>;
  }

  if (!data?.ok || !data.signal) {
    return <main className="min-h-screen bg-[#05070d] px-6 py-10 text-amber-200">{data?.error ?? "Signal not found"}</main>;
  }

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/signals" className="text-sm font-bold text-sky-300 hover:text-sky-200">← Back to Signal Ledger</Link>

        <section className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_34%),#090b13] p-6 shadow-2xl shadow-sky-950/30 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <ScoreRing score={data.signal.signalStrength} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-200">{signalTypeLabel(data.signal.signalType)}</span>
                <span className="rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-1 text-xs font-bold text-zinc-300">as of {data.signal.asOfDate}</span>
                <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">{data.source === "derived_topics" ? "Topic-derived" : "Signal table"}</span>
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{data.signal.topic}</h1>
              <p className="mt-5 max-w-4xl text-base leading-8 text-zinc-300">{data.signal.hypothesis}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Confidence" value={String(data.signal.confidenceScore)} tone="text-sky-300" />
          <MetricCard label="Heat" value={String(evidence.heat_score ?? "-")} tone="text-amber-300" />
          <MetricCard label="Sources" value={String(evidence.source_count ?? "-")} tone="text-emerald-300" />
          <MetricCard label="Articles" value={String(evidence.article_count ?? "-")} tone="text-zinc-100" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Investment Thesis</p>
            <h2 className="mt-3 text-2xl font-black">Why this matters</h2>
            <p className="mt-4 leading-8 text-zinc-300">{data.signal.hypothesis}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <SmallFact label="Category" value={evidence.category ?? "Market"} />
              <SmallFact label="Discovery" value={evidence.discovery_mode ?? data.signal.status} />
              <SmallFact label="Model" value={data.source === "derived_topics" ? "derived-topic-v1" : "signal-v1"} />
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Evidence</p>
            <div className="mt-5 space-y-3">
              <EvidenceRow label="Source mode" value={evidence.source ?? data.source ?? "signal"} />
              <EvidenceRow label="Topic id" value={String(evidence.topic_id ?? data.signal.id)} />
              <EvidenceRow label="Slug" value={String(evidence.slug ?? "-")} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Beneficiary Watchlist</p>
                <h2 className="mt-2 text-2xl font-black">Companies to monitor</h2>
              </div>
              <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-400">{watchlists.length} names</span>
            </div>
            <div className="mt-5 space-y-3">
              {watchlists.map((item) => (
                <div key={`${item.symbol}-${item.market}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-lg font-black text-white">{item.symbol}</div>
                    <div className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-200">{item.market}</div>
                  </div>
                  <p className="mt-1 text-sm font-bold text-zinc-300">{item.companyName}</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">{item.thesis}</p>
                </div>
              ))}
              {watchlists.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-5 text-sm leading-7 text-zinc-500">
                  Watchlist 尚未正式生成。這通常代表目前使用 topic-derived fallback；等 signal_events 正式寫入後，beneficiary mapping 會把相關公司接上來。
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Validation Windows</p>
            <h2 className="mt-2 text-2xl font-black">Outcome status</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {outcomes.map((outcome) => (
                <div key={outcome.horizon_days} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <p className="text-sm font-bold text-zinc-500">{outcome.horizon_days}D</p>
                  <p className="mt-2 text-2xl font-black capitalize text-white">{outcome.outcome}</p>
                  <p className="mt-3 text-sm text-zinc-500">Basket <span className="font-mono text-zinc-200">{pct(outcome.basket_return)}</span></p>
                  <p className="text-sm text-zinc-500">Benchmark <span className="font-mono text-zinc-200">{pct(outcome.benchmark_return)}</span></p>
                  <p className="text-sm text-zinc-500">Excess <span className="font-mono text-sky-300">{pct(outcome.excess_return)}</span></p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/90">
          <div className="border-b border-zinc-800 px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Return Table</p>
            <h2 className="mt-2 text-2xl font-black">Per-stock validation</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="bg-zinc-900/80 text-zinc-500">
                <tr>
                  <th className="px-6 py-4">Symbol</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4">Entry</th>
                  <th className="px-6 py-4">7D</th>
                  <th className="px-6 py-4">14D</th>
                  <th className="px-6 py-4">30D</th>
                  <th className="px-6 py-4">60D</th>
                </tr>
              </thead>
              <tbody>
                {returnRows.map((row) => (
                  <tr key={row.symbol} className="border-t border-zinc-900">
                    <td className="px-6 py-4 font-mono font-black text-white">{row.symbol}</td>
                    <td className="px-6 py-4 text-zinc-300">{row.companyName}</td>
                    <td className="px-6 py-4 font-mono text-zinc-400">{price(row.entryPrice)}</td>
                    <td className="px-6 py-4 font-mono text-zinc-400">{pct(row.returns[7])}</td>
                    <td className="px-6 py-4 font-mono text-zinc-400">{pct(row.returns[14])}</td>
                    <td className="px-6 py-4 font-mono text-zinc-400">{pct(row.returns[30])}</td>
                    <td className="px-6 py-4 font-mono text-zinc-400">{pct(row.returns[60])}</td>
                  </tr>
                ))}
                {returnRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-zinc-600">No stock price data yet. Import CSV first, then run backtest.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
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

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="mt-2 truncate text-sm font-bold text-zinc-200">{value}</p>
    </div>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="mt-2 break-all font-mono text-xs text-zinc-300">{value}</p>
    </div>
  );
}
