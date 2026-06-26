"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Outcome = {
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: string;
};

type SignalRow = {
  id: string;
  signalDate: string;
  asOfDate: string;
  topic: string;
  signalType: string;
  signalStrength: number;
  confidenceScore: number;
  hypothesis: string;
  status: string;
  watchlistCount: number;
  bestOutcome: Outcome | null;
};

type ApiResponse = {
  ok: boolean;
  source?: string;
  error?: string;
  signals: SignalRow[];
};

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined) return "待驗證";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function signalTypeLabel(value: string) {
  const labels: Record<string, string> = {
    news: "新聞訊號",
    price: "價格訊號",
    supply_chain: "供應鏈訊號",
    company_action: "企業行動",
    mixed: "混合訊號",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function lifecycle(signal: SignalRow) {
  if (signal.bestOutcome?.outcome === "success") return "validated";
  if (signal.signalStrength >= 75) return "growing";
  if (signal.signalStrength >= 45) return "emerging";
  return "watch";
}

function lifecycleStyle(value: string) {
  const styles: Record<string, { label: string; text: string; bg: string; border: string; dot: string }> = {
    emerging: { label: "剛浮現", text: "text-amber-300", bg: "bg-amber-400/10", border: "border-amber-300/30", dot: "bg-amber-300" },
    growing: { label: "升溫中", text: "text-sky-300", bg: "bg-sky-400/10", border: "border-sky-300/30", dot: "bg-sky-300" },
    validated: { label: "已驗證", text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-300/30", dot: "bg-emerald-300" },
    watch: { label: "觀察中", text: "text-zinc-300", bg: "bg-zinc-500/10", border: "border-zinc-500/40", dot: "bg-zinc-400" },
  };
  return styles[value] ?? styles.watch;
}

function scoreColor(score: number) {
  if (score >= 75) return "#10b981";
  if (score >= 45) return "#38bdf8";
  return "#f59e0b";
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const stroke = 4;
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
      <span className="z-10 font-mono text-lg font-black text-white">{score}</span>
    </div>
  );
}

const marketClusters = ["Compute", "Memory", "Packaging", "Cooling", "Power", "Networking"] as const;

const marketClusterLabels: Record<(typeof marketClusters)[number], string> = {
  Compute: "算力",
  Memory: "記憶體",
  Packaging: "先進封裝",
  Cooling: "散熱",
  Power: "電力",
  Networking: "網通",
};

function inferCluster(signal: SignalRow) {
  const text = `${signal.topic} ${signal.hypothesis}`.toLowerCase();
  if (/memory|dram|nand|hbm|micron|sk hynix|samsung/.test(text)) return "Memory";
  if (/packag|cowos|advanced packaging|tsmc|amkor|ase/.test(text)) return "Packaging";
  if (/cool|thermal|liquid|vertiv|heat/.test(text)) return "Cooling";
  if (/power|grid|transformer|electric|vernova|eaton/.test(text)) return "Power";
  if (/network|switch|ethernet|broadcom|optical/.test(text)) return "Networking";
  return "Compute";
}

export default function SignalsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/signals")
      .then((response) => response.json())
      .then((payload: ApiResponse) => setData(payload))
      .catch((error: Error) => setData({ ok: false, error: error.message, signals: [] }))
      .finally(() => setLoading(false));
  }, []);

  const signals = useMemo(() => data?.signals ?? [], [data?.signals]);
  const topSignal = signals[0];
  const stats = useMemo(() => {
    const validated = signals.filter((signal) => signal.bestOutcome?.outcome === "success").length;
    const avgStrength = signals.length ? Math.round(signals.reduce((sum, signal) => sum + signal.signalStrength, 0) / signals.length) : 0;
    return { validated, avgStrength };
  }, [signals]);
  const marketMap = useMemo(() => {
    return marketClusters.map((cluster) => {
      const clusterSignals = signals.filter((signal) => inferCluster(signal) === cluster);
      const strongest = clusterSignals.reduce<SignalRow | null>((best, signal) => (!best || signal.signalStrength > best.signalStrength ? signal : best), null);
      return {
        cluster,
        count: clusterSignals.length,
        strongest,
        score: strongest?.signalStrength ?? 0,
      };
    });
  }, [signals]);

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">AI 驅動市場研究平台</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">市場訊號資料庫</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
              這裡只放能轉成市場假設的訊號，聚焦供應鏈、價格、企業行動與可驗證的投資研究案例。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/reports/signal-validation" className="rounded-full border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:border-sky-400/60">
              驗證報告
            </Link>
            <Link href="/admin/backtest" className="rounded-full bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-sky-100">
              回測後台
            </Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">訊號數量</p>
            <p className="mt-2 font-mono text-3xl font-black">{signals.length}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">平均強度</p>
            <p className="mt-2 font-mono text-3xl font-black text-sky-300">{stats.avgStrength}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">已驗證</p>
            <p className="mt-2 font-mono text-3xl font-black text-emerald-300">{stats.validated}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">資料模式</p>
            <p className="mt-2 text-sm font-black text-amber-300">{data?.source === "derived_topics" ? "由主題推導" : "正式訊號表"}</p>
          </div>
        </section>

        {loading ? <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-zinc-400">正在讀取市場訊號...</div> : null}
        {!loading && data?.error ? <div className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-200">{data.error}</div> : null}

        {topSignal ? (
          <Link href={`/signals/${topSignal.id}`} className="group block rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_32%),#090b13] p-6 shadow-2xl shadow-sky-950/30 transition hover:border-sky-300/50 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <ScoreRing score={topSignal.signalStrength} size={82} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-200">最高信念訊號</span>
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-300">{signalTypeLabel(topSignal.signalType)}</span>
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">{topSignal.topic}</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">{topSignal.hypothesis}</p>
                <div className="mt-5 rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">一眼看懂價值</p>
                  {topSignal.bestOutcome ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <MiniStat label={`${topSignal.bestOutcome.horizon_days}日組合`} value={formatPct(topSignal.bestOutcome.basket_return)} tone="text-white" />
                      <MiniStat label="基準指數" value={formatPct(topSignal.bestOutcome.benchmark_return)} tone="text-zinc-300" />
                      <MiniStat label="超額報酬" value={formatPct(topSignal.bestOutcome.excess_return)} tone="text-emerald-300" />
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-zinc-400">
                      這個 signal 已形成研究假設，但尚未匯入足夠價格資料完成 outcome validation。下一步是匯入 basket 與 benchmark 價格，讓它從「可研究」變成「可驗證」。
                    </p>
                  )}
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <MiniStat label="信心分數" value={String(topSignal.confidenceScore)} tone="text-sky-300" />
                  <MiniStat label="觀察名單" value={String(topSignal.watchlistCount)} tone="text-zinc-200" />
                  <MiniStat label="最佳結果" value={topSignal.bestOutcome ? formatPct(topSignal.bestOutcome.excess_return) : "待驗證"} tone="text-emerald-300" />
                </div>
              </div>
              <span className="text-sm font-bold text-sky-300 transition group-hover:translate-x-1">查看研究假設 →</span>
            </div>
          </Link>
        ) : null}

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">市場地圖</p>
              <h2 className="mt-2 text-2xl font-black">AI 基礎建設訊號覆蓋</h2>
            </div>
            <p className="text-xs text-zinc-600">用來看 TrendRadar 目前在哪些產業環節已經偵測到市場相關訊號。</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {marketMap.map((item) => (
              <Link key={item.cluster} href={item.strongest ? `/signals/${item.strongest.id}` : "/signals"} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 transition hover:border-sky-400/50">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-white">{marketClusterLabels[item.cluster]}</p>
                  <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-bold text-zinc-400">{item.count} 個訊號</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.max(4, item.score)}%` }} />
                </div>
                <p className="mt-3 line-clamp-1 text-sm text-zinc-500">{item.strongest?.topic ?? "目前沒有活躍訊號"}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">研究訊號</p>
            <p className="text-xs text-zinc-600">已啟用市場相關篩選</p>
          </div>

          {signals.map((signal) => {
            const lc = lifecycle(signal);
            const style = lifecycleStyle(lc);
            return (
              <Link key={signal.id} href={`/signals/${signal.id}`} className="group block rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 transition hover:border-zinc-600 hover:bg-zinc-900">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <ScoreRing score={signal.signalStrength} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-white">{signal.topic}</h3>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${style.border} ${style.bg} ${style.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {style.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{signal.signalDate} · {signalTypeLabel(signal.signalType)} · confidence {signal.confidenceScore}</p>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-400">{signal.hypothesis}</p>
                    <div className="mt-4 flex items-center gap-1.5">
                      {["emerging", "growing", "validated"].map((step) => (
                        <span key={step} className={`h-1.5 flex-1 rounded-full ${step === lc || (lc === "validated" && step !== "watch") ? "bg-sky-400" : "bg-zinc-800"}`} />
                      ))}
                    </div>
                  </div>
                  <div className="min-w-28 text-left md:text-right">
                    <p className="font-mono text-xl font-black text-white">{signal.bestOutcome ? formatPct(signal.bestOutcome.excess_return) : "待驗證"}</p>
                    <p className="mt-1 text-xs text-zinc-600">30日超額</p>
                  </div>
                </div>
              </Link>
            );
          })}

          {!loading && signals.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-12 text-center">
              <p className="text-lg font-black text-white">目前還沒有市場訊號。</p>
              <p className="mt-2 text-sm text-zinc-500">目前 topics 裡沒有通過市場相關過濾的訊號。RSS sync 後若出現 AI、供應鏈、價格或企業行動主題，會自動顯示。</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={`mt-2 font-mono text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}
