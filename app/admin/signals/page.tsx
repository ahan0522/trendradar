"use client";

import { useState } from "react";

export default function AdminSignalsPage() {
  const [asOfDate, setAsOfDate] = useState("2026-03-31");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function generateSignals() {
    setLoading(true);
    setResult("");
    try {
      const response = await fetch("/api/admin/signals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asOfDate }),
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
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Admin Console</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Generate Signals</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
            根據 asOfDate 以前的資料產生 signal_events 與 watchlists。這是正式 Signal Ledger 的入口，不是舊新聞首頁。
          </p>
        </header>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
          <label className="text-sm font-bold text-zinc-400" htmlFor="asOfDate">asOfDate</label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input id="asOfDate" type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-lg font-bold text-white outline-none focus:border-sky-400" />
            <button onClick={generateSignals} disabled={loading} className="rounded-2xl bg-white px-6 py-3 font-black text-zinc-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Generating..." : "Generate Signals"}
            </button>
          </div>
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-100">
            Time Machine rule：產生訊號時只使用 asOfDate 以前的資料；asOfDate 之後的股價與新聞只能用於驗證 outcome。
          </div>
          <pre className="mt-6 max-h-96 overflow-auto rounded-2xl border border-zinc-800 bg-black p-4 text-xs leading-6 text-zinc-300">{result || "Result will appear here."}</pre>
        </section>
      </div>
    </main>
  );
}
