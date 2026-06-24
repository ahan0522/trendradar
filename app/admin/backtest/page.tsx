"use client";

import { useEffect, useState } from "react";

type SignalRow = {
  id: string;
  topic: string;
  signalDate: string;
};

export default function AdminBacktestPage() {
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [signalEventId, setSignalEventId] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/signals")
      .then((response) => response.json())
      .then((payload: { signals?: SignalRow[] }) => {
        setSignals(payload.signals ?? []);
        setSignalEventId(payload.signals?.[0]?.id ?? "");
      })
      .catch(() => setSignals([]));
  }, []);

  async function runBacktest(all: boolean) {
    setLoading(true);
    setResult("");
    try {
      const response = await fetch("/api/admin/signals/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(all ? {} : { signalEventId }),
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
      <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Run Backtest</h1>
      <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="text-sm font-bold text-slate-600" htmlFor="signal">Signal</label>
        <select id="signal" value={signalEventId} onChange={(event) => setSignalEventId(event.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold">
          {signals.map((signal) => <option key={signal.id} value={signal.id}>{signal.signalDate} - {signal.topic}</option>)}
        </select>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => runBacktest(false)} disabled={loading || !signalEventId} className="rounded-2xl bg-slate-950 px-6 py-3 font-bold text-white disabled:opacity-50">Run Selected 7/14/30/60D</button>
          <button onClick={() => runBacktest(true)} disabled={loading} className="rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-800 disabled:opacity-50">Run All Signals</button>
        </div>
        <pre className="mt-6 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{result || "Backtest result will appear here."}</pre>
      </section>
    </main>
  );
}
