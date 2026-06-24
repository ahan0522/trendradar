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
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Admin</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Import Stock Prices</h1>
      <p className="mt-3 text-slate-600">CSV format: symbol,market,date,open,high,low,close,adj_close,volume</p>
      <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <textarea value={csv} onChange={(event) => setCsv(event.target.value)} className="h-80 w-full rounded-2xl border border-slate-200 p-4 font-mono text-sm" />
        <button onClick={importCsv} disabled={loading} className="mt-4 rounded-2xl bg-slate-950 px-6 py-3 font-bold text-white disabled:opacity-50">
          {loading ? "Importing..." : "Import CSV"}
        </button>
        <pre className="mt-6 max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{result || "Import result will appear here."}</pre>
      </section>
    </main>
  );
}
