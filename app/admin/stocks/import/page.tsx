"use client";

import { useState } from "react";

const sampleCsv = `symbol,market,date,open,high,low,close,adj_close,volume
MU,US,2026-03-31,100,101,99,100,100,1000000
MU,US,2026-04-30,110,112,108,110,110,1000000
SPY,US,2026-03-31,500,502,498,500,500,1000000
SPY,US,2026-04-30,510,512,508,510,510,1000000`;

export default function ImportStocksPage() {
  const [csv, setCsv] = useState(sampleCsv);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function importCsv() {
    setLoading(true);
    setResult("");
    try {
      const response = await fetch("/api/admin/stocks/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-zinc-400">CSV Input</p>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-500">symbol + market + date upsert</span>
          </div>
          <textarea value={csv} onChange={(event) => setCsv(event.target.value)} className="h-80 w-full rounded-2xl border border-zinc-800 bg-black p-4 font-mono text-sm leading-6 text-zinc-200 outline-none focus:border-sky-400" />
          <button onClick={importCsv} disabled={loading} className="mt-4 rounded-2xl bg-white px-6 py-3 font-black text-zinc-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Importing..." : "Import CSV"}
          </button>
          <pre className="mt-6 max-h-72 overflow-auto rounded-2xl border border-zinc-800 bg-black p-4 text-xs leading-6 text-zinc-300">{result || "Import result will appear here."}</pre>
        </section>
      </div>
    </main>
  );
}
