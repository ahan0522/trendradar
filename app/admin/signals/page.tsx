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
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Admin</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Generate Signals</h1>
      <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="text-sm font-bold text-slate-600" htmlFor="asOfDate">asOfDate</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input id="asOfDate" type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-lg font-bold" />
          <button onClick={generateSignals} disabled={loading} className="rounded-2xl bg-slate-950 px-6 py-3 font-bold text-white disabled:opacity-50">
            {loading ? "Generating..." : "Generate Signals"}
          </button>
        </div>
        <pre className="mt-6 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{result || "Result will appear here."}</pre>
      </section>
    </main>
  );
}
