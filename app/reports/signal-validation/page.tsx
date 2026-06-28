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

type WatchlistRow = {
  signal_event_id: string;
  symbol: string;
  company_name: string;
  market: string;
};

type OutcomeRow = {
  signal_event_id: string;
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: string;
};

type ReportResponse = {
  ok: boolean;
  error?: string;
  summary: {
    signalCount: number;
    validatedOutcomeCount: number;
    successRate: number;
    averageBasketReturn: number;
    averageExcessReturn: number;
  } | null;
  signals: SignalRow[];
  watchlists: WatchlistRow[];
  outcomes: OutcomeRow[];
  historicalValidation?: HistoricalValidation | null;
};

type HistoricalCase = {
  signalId: string;
  modelVersion: string;
  month: string;
  topic: string;
  family: string;
  watchlist: Array<{ symbol: string; companyName: string; market: string }>;
  basketReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  outcome: "success" | "partial" | "failed";
};

type HistoricalValidation = {
  period: string;
  methodology: string;
  verdict: string;
  verdictText: string;
  executiveSummary: string;
  coverage: {
    baselineSignals: number;
    candidateSignals: number;
    coverageBreadthLift: number;
  };
  performance: {
    baseline: ModelPerformance;
    candidate: ModelPerformance;
    alphaDelta: number | null;
    successRateDelta: number | null;
  };
  dataQuality: {
    totalSignals: number;
    mappedSignals: number;
    completeThirtyDaySamples: number;
    missingPriceSignals: number;
    unmappedSignals: number;
    caveat: string;
  };
  strongestCases: HistoricalCase[];
  failedCases: HistoricalCase[];
};

type ModelPerformance = {
  signalCount: number;
  mappedCount: number;
  testedCount: number;
  averageThirtyDayExcessReturn: number | null;
  thirtyDaySuccessRate: number | null;
};

type PublicWatchlist = {
  symbol: string;
  companyName: string;
  market: string;
  thesis: string;
  latestPrice: {
    priceDate: string;
    close: number;
    adjClose: number | null;
  } | null;
  priceQuality?: {
    status: "verified" | "needs_review";
    reason?: string;
  };
};

type PublicSignal = {
  id: string;
  signalDate: string;
  asOfDate: string;
  topic: string;
  signalType: string;
  signalStrength: number;
  confidenceScore: number;
  hypothesis: string;
  watchlists?: PublicWatchlist[];
};

type PublicSignalsResponse = {
  ok: boolean;
  source?: string;
  signals: PublicSignal[];
};

function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return "待驗證";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function rate(value: number | null | undefined) {
  if (value === null || value === undefined) return "待驗證";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

const monthLabels: Record<string, string> = {
  "03": "三月訊號",
  "04": "四月訊號",
  "05": "五月訊號",
  "06": "六月驗證",
};

export default function SignalValidationReportPage() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [publicData, setPublicData] = useState<PublicSignalsResponse | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/reports/signal-validation").then((response) => response.json()),
      fetch("/api/signals").then((response) => response.json()),
    ])
      .then(([reportPayload, publicPayload]: [ReportResponse, PublicSignalsResponse]) => {
        setData(reportPayload);
        setPublicData(publicPayload);
      })
      .catch((error: Error) => {
        setData({ ok: false, error: error.message, summary: null, signals: [], watchlists: [], outcomes: [] });
        setPublicData({ ok: false, signals: [] });
      });
  }, []);

  const signals = useMemo(() => data?.signals ?? [], [data?.signals]);
  const bySignal = useMemo(() => {
    const watchlists = new Map<string, WatchlistRow[]>();
    const outcomes = new Map<string, OutcomeRow[]>();
    for (const row of data?.watchlists ?? []) watchlists.set(row.signal_event_id, [...(watchlists.get(row.signal_event_id) ?? []), row]);
    for (const row of data?.outcomes ?? []) outcomes.set(row.signal_event_id, [...(outcomes.get(row.signal_event_id) ?? []), row]);
    return { watchlists, outcomes };
  }, [data]);

  const monthSections = useMemo(() => {
    const sections = new Map<string, SignalRow[]>();
    for (const signal of signals) {
      const month = signal.signal_date.slice(5, 7);
      sections.set(month, [...(sections.get(month) ?? []), signal]);
    }
    return sections;
  }, [signals]);
  const publicSignals = useMemo(
    () => [...(publicData?.signals ?? [])].sort((a, b) => b.signalStrength - a.signalStrength || b.confidenceScore - a.confidenceScore).slice(0, 3),
    [publicData?.signals],
  );

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_34%),#090b13] p-6 shadow-2xl shadow-sky-950/30 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">AI 驅動市場研究平台</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">市場訊號驗證報告</h1>
              <p className="mt-4 text-xl font-bold text-zinc-300">
                {data ? (data.historicalValidation?.period ?? "持續更新") : "載入驗證資料中"}
              </p>
            </div>
            <Link href="/signals" className="rounded-full bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-sky-100">
              查看市場訊號資料庫
            </Link>
          </div>
        </section>

        {data?.error ? <div className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-200">{data.error}</div> : null}

        <section className="grid gap-3 md:grid-cols-4">
          <MetricCard label="訊號數量" value={data ? String(data.summary?.signalCount ?? signals.length) : "—"} tone="text-white" />
          <MetricCard label="已驗證結果" value={data ? String(data.summary?.validatedOutcomeCount ?? 0) : "—"} tone="text-emerald-300" />
          <MetricCard label="成功率" value={data ? pct(data.summary?.successRate) : "—"} tone="text-sky-300" />
          <MetricCard label="平均超額報酬" value={data ? pct(data.summary?.averageExcessReturn) : "—"} tone="text-amber-300" />
        </section>

        <ReportSection index="1" title="執行摘要">
          TrendRadar 將新聞、價格、供應鏈與企業行動轉換成可驗證的市場訊號。這份報告呈現 Signal Ledger、watchlist 與後續報酬驗證，用來檢查訊號是否具備投資研究價值。
        </ReportSection>

        <ReportSection index="2" title="研究方法">
          Time Machine Simulation（時間機模擬）：每個訊號只能使用 as_of_date 之前的資料產生。as_of_date 之後的資料只能用於結果驗證，避免把未來資訊混入訊號形成階段。
        </ReportSection>

        {data?.historicalValidation ? (
          <HistoricalValidationSection report={data.historicalValidation} />
        ) : null}

        {publicSignals.length > 0 ? (
          <section className="rounded-3xl border border-sky-400/20 bg-sky-400/10 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-200">Current Research Brief</p>
            <h2 className="mt-2 text-3xl font-black">目前使用者看得懂的研究摘要</h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-sky-50/75">
              這裡只列 1-3 個夠強的候選訊號。每個訊號都要回答三件事：發生什麼變化、為什麼值得追蹤、台股/美股有哪些標的要觀察。
            </p>
            <div className="mt-6 grid gap-4">
              {publicSignals.map((signal) => (
                <article key={signal.id} className="rounded-3xl border border-zinc-800 bg-zinc-950/85 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                        {signal.signalDate} · Strength {signal.signalStrength} · Confidence {signal.confidenceScore}
                      </p>
                      <h3 className="mt-2 text-2xl font-black text-white">{signal.topic}</h3>
                      <p className="mt-3 max-w-5xl text-sm leading-7 text-zinc-400">{signal.hypothesis}</p>
                    </div>
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-200">
                      候選研究
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {(signal.watchlists ?? []).slice(0, 6).map((item) => (
                      <div key={`${signal.id}-${item.market}-${item.symbol}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-white">{item.companyName || item.symbol}</p>
                            <p className="mt-1 text-xs text-zinc-500">{item.market} · {item.symbol}</p>
                          </div>
                          <p className="text-right font-mono text-xs font-black text-sky-300">
                            {item.latestPrice ? `${Number(item.latestPrice.adjClose ?? item.latestPrice.close).toFixed(2)}` : "待驗證"}
                          </p>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-zinc-500">{item.thesis}</p>
                        {item.priceQuality?.status === "needs_review" ? (
                          <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
                            價格資料：{item.priceQuality.reason}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/90">
          <div className="border-b border-zinc-800 px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">3. Signal Ledger</p>
            <h2 className="mt-2 text-2xl font-black">可驗證的市場訊號</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-zinc-900/80 text-zinc-500">
                <tr>
                  <th className="px-6 py-4">訊號日期</th>
                  <th className="px-6 py-4">主題</th>
                  <th className="px-6 py-4">類型</th>
                  <th className="px-6 py-4">強度</th>
                  <th className="px-6 py-4">觀察名單</th>
                  <th className="px-6 py-4">30日組合</th>
                  <th className="px-6 py-4">30日超額</th>
                  <th className="px-6 py-4">結果</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal) => {
                  const outcome30 = bySignal.outcomes.get(signal.id)?.find((row) => row.horizon_days === 30);
                  return (
                    <tr key={signal.id} className="border-t border-zinc-900">
                      <td className="px-6 py-4 font-mono text-zinc-400">{signal.signal_date}</td>
                      <td className="px-6 py-4 font-black text-white">{signal.topic}</td>
                      <td className="px-6 py-4 text-zinc-400">{signal.signal_type.replaceAll("_", " ")}</td>
                      <td className="px-6 py-4 font-mono font-black text-amber-300">{signal.signal_strength}</td>
                      <td className="px-6 py-4 text-zinc-300">{bySignal.watchlists.get(signal.id)?.length ?? 0}</td>
                      <td className="px-6 py-4 font-mono text-zinc-400">{pct(outcome30?.basket_return)}</td>
                      <td className="px-6 py-4 font-mono text-sky-300">{pct(outcome30?.excess_return)}</td>
                    <td className="px-6 py-4 capitalize text-zinc-300">{outcome30?.outcome ?? "pending"}</td>
                    </tr>
                  );
                })}
                {signals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-zinc-600">目前還沒有正式訊號。可先使用 topic-derived preview，或從後台產生正式 signal。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {["03", "04", "05"].map((month, index) => (
          <section key={month} className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">{index + 4}. {monthLabels[month]}</p>
            <div className="mt-5 space-y-4">
              {(monthSections.get(month) ?? []).map((signal) => (
                <Link key={signal.id} href={`/signals/${signal.id}`} className="block rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition hover:border-sky-400/50">
                  <h3 className="text-2xl font-black">{signal.topic}</h3>
                  <p className="mt-3 leading-7 text-zinc-400">{signal.hypothesis}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(bySignal.watchlists.get(signal.id) ?? []).map((item) => (
                      <span key={`${signal.id}-${item.symbol}`} className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-zinc-300">
                        {item.company_name || item.symbol}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
              {(monthSections.get(month) ?? []).length === 0 ? <p className="text-sm text-zinc-600">這個月份目前沒有訊號。</p> : null}
            </div>
          </section>
        ))}

        <ReportSection index="7" title="六月驗證">
          整理三、四、五月 signal 的驗證結果。30D 與 60D outcome 用來判斷訊號是否具備延續性；pending 代表目前缺少股價資料或尚未匯入 benchmark。
        </ReportSection>

        <ReportSection index="8" title="結論">
          TrendRadar 的價值不是 AI 摘要，而是可驗證的 Signal Ledger。第一版先用 CSV、rule-based watchlist 與手動資料建立閉環，後續再接真實資料源、AI 命名與更嚴格的 validation。
        </ReportSection>
      </div>
    </main>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function ReportSection({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">{index}. {title}</p>
      <h2 className="mt-2 text-2xl font-black">{title}</h2>
      <p className="mt-4 max-w-4xl text-base leading-8 text-zinc-400">{children}</p>
    </section>
  );
}

function HistoricalValidationSection({ report }: { report: HistoricalValidation }) {
  const models = [
    { label: "舊版固定規則", data: report.performance.baseline, tone: "border-zinc-800 bg-zinc-950/80" },
    { label: "新版全市場 Discovery", data: report.performance.candidate, tone: "border-sky-300/20 bg-sky-400/5" },
  ];

  return (
    <section className="rounded-3xl border border-violet-300/20 bg-violet-400/5 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300">Historical Validation</p>
      <h2 className="mt-2 text-3xl font-black">歷史重播得出的研究結論</h2>
      <p className="mt-4 max-w-5xl text-base leading-8 text-zinc-300">{report.executiveSummary}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="唯一訊號" value={String(report.dataQuality.totalSignals)} tone="text-white" />
        <MetricCard label="30D 完整樣本" value={String(report.dataQuality.completeThirtyDaySamples)} tone="text-emerald-300" />
        <MetricCard label="覆蓋增幅" value={rate(report.coverage.coverageBreadthLift)} tone="text-sky-300" />
        <MetricCard label="待補價格" value={String(report.dataQuality.missingPriceSignals)} tone="text-amber-300" />
        <MetricCard label="不硬映射" value={String(report.dataQuality.unmappedSignals)} tone="text-zinc-300" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {models.map((model) => (
          <article key={model.label} className={`rounded-2xl border p-5 ${model.tone}`}>
            <p className="font-black text-white">{model.label}</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <ResearchMetric label="30D 樣本" value={String(model.data.testedCount)} />
              <ResearchMetric label="平均 Alpha" value={pct(model.data.averageThirtyDayExcessReturn)} />
              <ResearchMetric label="成功率" value={rate(model.data.thirtyDaySuccessRate)} />
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <CaseList title="目前表現較強的研究案例" cases={report.strongestCases} positive />
        <CaseList title="必須保留的失敗案例" cases={report.failedCases} />
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm leading-7 text-zinc-500">
        <p>{report.methodology}</p>
        <p className="mt-1">{report.dataQuality.caveat}</p>
      </div>
    </section>
  );
}

function ResearchMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="mt-1 font-mono text-lg font-black text-white">{value}</p>
    </div>
  );
}

function CaseList({ title, cases, positive = false }: { title: string; cases: HistoricalCase[]; positive?: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
      <h3 className="font-black text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {cases.map((item) => (
          <article key={`${item.modelVersion}-${item.signalId}`} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold text-zinc-500">{item.month} · {item.family}</p>
                <p className="mt-1 font-bold text-white">{item.topic}</p>
              </div>
              <p className={`shrink-0 font-mono text-lg font-black ${positive ? "text-emerald-300" : "text-rose-300"}`}>
                {pct(item.excessReturn)}
              </p>
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              觀察標的：{item.watchlist.map((watch) => watch.symbol).join("、")}
            </p>
          </article>
        ))}
        {cases.length === 0 ? <p className="py-3 text-sm text-zinc-600">目前沒有足夠完整的案例。</p> : null}
      </div>
    </div>
  );
}
