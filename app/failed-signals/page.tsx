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

type OutcomeRow = {
  signal_event_id: string;
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: "success" | "partial" | "failed" | "pending";
};

type ReportResponse = {
  ok: boolean;
  source?: string;
  error?: string;
  signals: SignalRow[];
  outcomes: OutcomeRow[];
};

function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return "待驗證";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function outcomeLabel(value: OutcomeRow["outcome"]) {
  const labels = {
    success: "成功",
    partial: "部分成立",
    failed: "失敗",
    pending: "待驗證",
  };
  return labels[value];
}

export default function FailedSignalsPage() {
  const [data, setData] = useState<ReportResponse | null>(null);

  useEffect(() => {
    fetch("/api/reports/signal-validation")
      .then((response) => response.json())
      .then((payload: ReportResponse) => setData(payload))
      .catch((error: Error) => setData({ ok: false, error: error.message, signals: [], outcomes: [] }));
  }, []);

  const rows = useMemo(() => {
    const signals = data?.signals ?? [];
    const outcomes = data?.outcomes ?? [];
    return signals.map((signal) => {
      const signalOutcomes = outcomes.filter((outcome) => outcome.signal_event_id === signal.id);
      const failed = signalOutcomes.find((outcome) => outcome.outcome === "failed");
      const longest = [...signalOutcomes].sort((a, b) => b.horizon_days - a.horizon_days)[0] ?? null;
      const representative = failed ?? longest;
      return {
        signal,
        representative,
        state: representative?.outcome ?? "pending",
      };
    });
  }, [data]);

  const failedRows = rows.filter((row) => row.state === "failed");
  const pendingRows = rows.filter((row) => row.state === "pending");
  const partialRows = rows.filter((row) => row.state === "partial");

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-[2rem] border border-rose-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.18),_transparent_34%),#090b13] p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-300">Failed Signals</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">失敗訊號與待驗證紀錄</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
            真正可信的 Signal Ledger 不能只展示成功案例。失敗、部分成立、資料不足，都應該被保存，讓模型和研究流程能持續修正。
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-zinc-300">失敗：{failedRows.length}</span>
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-zinc-300">部分成立：{partialRows.length}</span>
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-zinc-300">待驗證：{pendingRows.length}</span>
            <Link href="/reports/signal-validation" className="rounded-full bg-white px-4 py-2 font-black text-zinc-950 transition hover:bg-rose-100">
              查看完整驗證報告
            </Link>
          </div>
        </header>

        {data?.error ? <div className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-200">{data.error}</div> : null}

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">透明原則</p>
          <h2 className="mt-2 text-2xl font-black">沒有失敗資料，不代表模型成功。</h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-400">
            第一版如果大多數訊號都是 pending，代表缺少價格資料或驗證時間還沒到。這不是壞事，它提醒我們下一步應該優先補齊股價資料、benchmark、資料來源，而不是急著宣稱成功率。
          </p>
        </section>

        <SignalGroup title="已失敗訊號" description="這些 signal 的超額報酬為負，或假設沒有被後續資料支持。" rows={failedRows} emptyText="目前沒有已標記失敗的 signal。等回測資料更完整後，這裡會成為模型修正的關鍵頁。" />
        <SignalGroup title="部分成立" description="方向可能對，但效果不夠強，或只有部分期限勝過 benchmark。" rows={partialRows} emptyText="目前沒有部分成立的 signal。" />
        <SignalGroup title="待驗證" description="已形成研究假設，但缺少足夠股價資料或驗證期限尚未完成。" rows={pendingRows} emptyText="目前沒有待驗證 signal。" />
      </div>
    </main>
  );
}

function SignalGroup({
  title,
  description,
  rows,
  emptyText,
}: {
  title: string;
  description: string;
  rows: Array<{
    signal: SignalRow;
    representative: OutcomeRow | null;
    state: OutcomeRow["outcome"];
  }>;
  emptyText: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-2xl font-black">{title}</h2>
        <p className="mt-2 text-sm text-zinc-500">{description}</p>
      </div>
      {rows.map((row) => (
        <Link key={row.signal.id} href={`/signals/${row.signal.id}`} className="block rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 transition hover:border-rose-300/50">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-black text-white">{row.signal.topic}</h3>
                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-bold text-zinc-300">
                  {outcomeLabel(row.state)}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-600">{row.signal.signal_date} · {row.signal.signal_type.replaceAll("_", " ")} · strength {row.signal.signal_strength}</p>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-400">{row.signal.hypothesis}</p>
              <p className="mt-4 text-sm font-bold text-zinc-500">
                教訓：{row.state === "pending" ? "先補資料，再下結論。" : row.state === "failed" ? "記錄失敗原因，回頭修正 signal rule 和 beneficiary mapping。" : "確認哪個期限或哪些受惠股真正有效。"}
              </p>
            </div>
            <div className="grid min-w-44 grid-cols-2 gap-3 text-left md:text-right">
              <div>
                <p className="font-mono text-lg font-black text-white">{row.representative ? `${row.representative.horizon_days}D` : "N/A"}</p>
                <p className="text-xs text-zinc-600">期限</p>
              </div>
              <div>
                <p className="font-mono text-lg font-black text-rose-300">{pct(row.representative?.excess_return)}</p>
                <p className="text-xs text-zinc-600">超額</p>
              </div>
            </div>
          </div>
        </Link>
      ))}
      {rows.length === 0 ? <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-8 text-sm text-zinc-600">{emptyText}</div> : null}
    </section>
  );
}
