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

function fmt(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${Number(value).toFixed(2)}%`;
}

function price(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(2);
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

  if (loading) return <main className="mx-auto max-w-6xl px-6 py-10">Loading signal...</main>;
  if (!data?.ok || !data.signal) return <main className="mx-auto max-w-6xl px-6 py-10 text-amber-800">{data?.error ?? "Signal not found"}</main>;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/signals" className="text-sm font-bold text-blue-700">Back to Signal Ledger</Link>
      <section className="mt-5 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Signal Detail</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">{data.signal.topic}</h1>
            <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-700">{data.signal.hypothesis}</p>
          </div>
          <div className="rounded-2xl bg-slate-950 p-5 text-white">
            <div className="text-sm text-slate-300">Strength</div>
            <div className="text-4xl font-black">{data.signal.signalStrength}</div>
            <div className="mt-2 text-sm text-slate-300">Confidence {data.signal.confidenceScore}</div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-2xl font-black">Evidence</h2>
          <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(data.signal.evidence, null, 2)}</pre>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-2xl font-black">Watchlist</h2>
          <div className="mt-4 space-y-3">
            {(data.watchlists ?? []).map((item) => (
              <div key={`${item.symbol}-${item.market}`} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-black text-slate-950">{item.symbol} <span className="font-semibold text-slate-500">{item.companyName}</span></div>
                  <div className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{item.market}</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.thesis}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-2xl font-black">Return Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
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
                <tr key={row.symbol} className="border-t border-slate-100">
                  <td className="px-6 py-4 font-black">{row.symbol}</td>
                  <td className="px-6 py-4">{row.companyName}</td>
                  <td className="px-6 py-4">{price(row.entryPrice)}</td>
                  <td className="px-6 py-4">{fmt(row.returns[7])}</td>
                  <td className="px-6 py-4">{fmt(row.returns[14])}</td>
                  <td className="px-6 py-4">{fmt(row.returns[30])}</td>
                  <td className="px-6 py-4">{fmt(row.returns[60])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {(data.outcomes ?? []).map((outcome) => (
          <div key={outcome.horizon_days} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm font-bold text-slate-500">{outcome.horizon_days}D Outcome</div>
            <div className="mt-2 text-2xl font-black capitalize">{outcome.outcome}</div>
            <div className="mt-3 text-sm text-slate-600">Basket {fmt(outcome.basket_return)}</div>
            <div className="text-sm text-slate-600">Benchmark {fmt(outcome.benchmark_return)}</div>
            <div className="text-sm font-bold text-blue-700">Excess {fmt(outcome.excess_return)}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
