"use client";

import { useState } from "react";
import { AdminSecretField } from "@/components/AdminSecretField";

type ReplayBackfillResponse = {
  ok?: boolean;
  prices?: {
    runId: string;
    dryRun: boolean;
    requestCount: number;
    fetched: number;
    upserted: number;
    selectedSymbols: Array<{ symbol: string; market: string; count: number }>;
    skippedSummary: {
      byReason: Array<{ reason: string; count: number }>;
      bySymbol: Array<{
        symbol: string;
        count: number;
        reasons: Array<{ reason: string; count: number }>;
        suggestedAction: string;
      }>;
    };
  };
  backtest?: unknown;
  error?: string;
};

const sampleCsv = `symbol,market,date,open,high,low,close,adj_close,volume
MU,US,2026-03-31,100,101,99,100,100,1000000
MU,US,2026-04-30,110,112,108,110,110,1000000
SPY,US,2026-03-31,500,502,498,500,500,1000000
SPY,US,2026-04-30,510,512,508,510,510,1000000`;

export default function ImportStocksPage() {
  const [csv, setCsv] = useState(sampleCsv);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayResult, setReplayResult] = useState<ReplayBackfillResponse | null>(null);
  const [adminSecret, setAdminSecret] = useState("");

  async function importCsv() {
    setLoading(true);
    setResult("");
    try {
      const response = await fetch("/api/admin/stocks/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
        body: JSON.stringify({ csv }),
      });
      const payload = await response.json();
      setResult(JSON.stringify(payload, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function runReplayBackfill(dryRun: boolean) {
    setReplayLoading(true);
    setReplayResult(null);
    try {
      const response = await fetch("/api/admin/stocks/backfill-replay", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
        body: JSON.stringify({ dryRun, maxSymbols: 8, horizons: [30] }),
      });
      const payload = await response.json();
      setReplayResult(payload);
    } catch (error) {
      setReplayResult({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setReplayLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Admin Console</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Import Stock Prices</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
            第一版先用 CSV 匯入，建立 signal validation 的價格基礎。格式固定為 symbol, market, date, open, high, low, close, adj_close, volume。
          </p>
        </header>

        <AdminSecretField value={adminSecret} onChange={setAdminSecret} />

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-zinc-400">CSV Input</p>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-500">symbol + market + date upsert</span>
          </div>
          <textarea value={csv} onChange={(event) => setCsv(event.target.value)} className="h-80 w-full rounded-2xl border border-zinc-800 bg-black p-4 font-mono text-sm leading-6 text-zinc-200 outline-none focus:border-sky-400" />
          <button onClick={importCsv} disabled={loading || !adminSecret} className="mt-4 rounded-2xl bg-white px-6 py-3 font-black text-zinc-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Importing..." : "Import CSV"}
          </button>
          <pre className="mt-6 max-h-72 overflow-auto rounded-2xl border border-zinc-800 bg-black p-4 text-xs leading-6 text-zinc-300">{result || "Import result will appear here."}</pre>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-300">Replay Price Gaps</p>
              <h2 className="mt-2 text-2xl font-black">Model Replay 價格缺口診斷</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-400">
                這裡會檢查最新 replay 回測缺價的標的，先用 dry-run 看哪些價格可補、哪些被品質閘門擋下。被擋下的樣本會保留 pending，不會硬塞進回測。
              </p>
            </div>
            <span className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs font-bold text-zinc-500">30D horizon / top 8 symbols</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => runReplayBackfill(true)}
              disabled={replayLoading || !adminSecret}
              className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-black text-zinc-100 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {replayLoading ? "Checking..." : "Dry-run Diagnostics"}
            </button>
            <button
              onClick={() => runReplayBackfill(false)}
              disabled={replayLoading || !adminSecret}
              className="rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {replayLoading ? "Backfilling..." : "Backfill Verified Prices"}
            </button>
          </div>

          {replayResult ? (
            <div className="mt-6 space-y-5">
              {!replayResult.ok ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
                  {replayResult.error || "Replay price backfill failed."}
                </div>
              ) : replayResult.prices ? (
                <>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                      <p className="text-xs font-bold text-zinc-500">Run ID</p>
                      <p className="mt-2 break-all text-sm font-bold text-zinc-200">{replayResult.prices.runId}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                      <p className="text-xs font-bold text-zinc-500">Requests</p>
                      <p className="mt-2 text-3xl font-black">{replayResult.prices.requestCount}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                      <p className="text-xs font-bold text-zinc-500">Fetched</p>
                      <p className="mt-2 text-3xl font-black">{replayResult.prices.fetched}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                      <p className="text-xs font-bold text-zinc-500">Upserted</p>
                      <p className="mt-2 text-3xl font-black">{replayResult.prices.upserted}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                      <h3 className="font-black">Blocked Reasons</h3>
                      <div className="mt-4 space-y-2">
                        {replayResult.prices.skippedSummary.byReason.length === 0 ? (
                          <p className="text-sm text-zinc-500">No skipped rows.</p>
                        ) : replayResult.prices.skippedSummary.byReason.map((item) => (
                          <div key={item.reason} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-900 px-3 py-2 text-sm">
                            <span className="text-zinc-300">{item.reason}</span>
                            <span className="font-black text-amber-200">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                      <h3 className="font-black">Symbols Needing Repair</h3>
                      <div className="mt-4 space-y-3">
                        {replayResult.prices.skippedSummary.bySymbol.length === 0 ? (
                          <p className="text-sm text-zinc-500">No symbol-level gaps.</p>
                        ) : replayResult.prices.skippedSummary.bySymbol.slice(0, 8).map((item) => (
                          <div key={item.symbol} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-lg font-black">{item.symbol}</p>
                              <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-400">{item.count} gaps</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.reasons.map((reason) => (
                                <span key={reason.reason} className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300">
                                  {reason.reason} x {reason.count}
                                </span>
                              ))}
                            </div>
                            <p className="mt-3 rounded-xl bg-amber-950/30 p-3 text-sm leading-6 text-amber-100">{item.suggestedAction}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
              Run dry-run first. The result will show which price gaps are safe to backfill and which must remain pending.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
