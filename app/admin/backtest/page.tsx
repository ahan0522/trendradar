"use client";

import { useEffect, useState } from "react";
import { AdminSecretField } from "@/components/AdminSecretField";

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
  const [adminSecret, setAdminSecret] = useState("");

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
        headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
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
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Admin Console</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Run Backtest</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
            匯入股價後，對 signal watchlist 跑 7/14/30/60 天報酬驗證。缺價格資料時結果會保持 pending。
          </p>
        </header>

        <AdminSecretField value={adminSecret} onChange={setAdminSecret} />

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
          <label className="text-sm font-bold text-zinc-400" htmlFor="signal">Signal</label>
          <select id="signal" value={signalEventId} onChange={(event) => setSignalEventId(event.target.value)} className="mt-3 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 font-bold text-white outline-none focus:border-sky-400">
            {signals.map((signal) => <option key={signal.id} value={signal.id}>{signal.signalDate} - {signal.topic}</option>)}
          </select>
          {signals.length === 0 ? <p className="mt-3 text-sm text-amber-300">目前沒有 signal 可回測。先到「市場訊號」確認是否有 topic-derived 訊號，或到「產生訊號」寫入正式 signal_events。</p> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => runBacktest(false)} disabled={loading || !signalEventId || !adminSecret} className="rounded-2xl bg-white px-6 py-3 font-black text-zinc-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">
              Run Selected 7/14/30/60D
            </button>
            <button onClick={() => runBacktest(true)} disabled={loading || !adminSecret} className="rounded-2xl border border-zinc-700 bg-zinc-900 px-6 py-3 font-bold text-zinc-200 transition hover:border-sky-400/60 disabled:cursor-not-allowed disabled:opacity-50">
              Run All Signals
            </button>
          </div>

          <pre className="mt-6 max-h-96 overflow-auto rounded-2xl border border-zinc-800 bg-black p-4 text-xs leading-6 text-zinc-300">{result || "Backtest result will appear here."}</pre>
        </section>
      </div>
    </main>
  );
}
