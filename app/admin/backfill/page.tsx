"use client";

import { useMemo, useState } from "react";

type CoverageMetric = {
  available: boolean;
  count: number | null;
  error?: string;
};

type CoverageRow = {
  month: string;
  articles: CoverageMetric;
  effectiveSources: CoverageMetric;
  stockPrices: CoverageMetric;
  marketPriceSeries: CoverageMetric;
  researchStatus: {
    code: string;
    label: string;
    reason: string;
  };
};

type CoverageResponse = {
  ok: boolean;
  generatedAt?: string;
  rows?: CoverageRow[];
  totals?: {
    articles: number;
    effectiveSources: number;
    stockPrices: number;
    marketPriceSeries: number;
  };
  error?: string;
};

const defaultQueries = [
  "HBM AI server",
  "DRAM price AI",
  "NAND price AI",
  "CoWoS capacity",
  "AI data center power",
  "liquid cooling data center",
  "optical module AI data center",
  "custom ASIC hyperscaler",
  "EDA AI chip design",
].join("\n");

const articleExample = `[
  {
    "title": "Example historical article",
    "url": "https://example.com/article",
    "sourceName": "Example Source",
    "publishedAt": "2026-03-15",
    "description": "Short metadata summary",
    "category": "AI Infrastructure",
    "region": "GLOBAL"
  }
]`;

function metricText(metric?: CoverageMetric) {
  if (!metric) return "-";
  if (!metric.available) return "N/A";
  return String(metric.count ?? 0);
}

export default function BackfillAdminPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [startDate, setStartDate] = useState("2025-01-01");
  const [endDate, setEndDate] = useState("2026-04-30");
  const [queriesText, setQueriesText] = useState(defaultQueries);
  const [articlesJson, setArticlesJson] = useState("");
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [backfillResult, setBackfillResult] = useState<unknown>(null);
  const [simulationResult, setSimulationResult] = useState<unknown>(null);
  const [simulationYear, setSimulationYear] = useState("2026");
  const [simulationMonth, setSimulationMonth] = useState("3");
  const [loading, setLoading] = useState<string | null>(null);

  const queries = useMemo(
    () => queriesText.split("\n").map((item) => item.trim()).filter(Boolean),
    [queriesText],
  );

  function headers() {
    return {
      "Content-Type": "application/json",
      "x-admin-secret": adminSecret,
    };
  }

  async function loadCoverage() {
    setLoading("coverage");
    setCoverage(null);
    try {
      const response = await fetch("/api/admin/data-coverage?startMonth=2025-01&endMonth=2026-06", {
        headers: { "x-admin-secret": adminSecret },
      });
      setCoverage((await response.json()) as CoverageResponse);
    } finally {
      setLoading(null);
    }
  }

  async function runBackfill() {
    setLoading("backfill");
    setBackfillResult(null);
    try {
      let articles: unknown[] = [];
      if (articlesJson.trim()) {
        const parsed = JSON.parse(articlesJson);
        articles = Array.isArray(parsed) ? parsed : [];
      }

      const response = await fetch("/api/admin/backfill/news", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          startDate,
          endDate,
          queries,
          articles,
          provider: articles.length > 0 ? "manual" : "google_news",
        }),
      });
      setBackfillResult(await response.json());
    } catch (error) {
      setBackfillResult({ ok: false, error: error instanceof Error ? error.message : "Backfill failed." });
    } finally {
      setLoading(null);
    }
  }

  async function runSimulation() {
    setLoading("simulation");
    setSimulationResult(null);
    try {
      const response = await fetch("/api/admin/simulations/run-month", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ year: Number(simulationYear), month: Number(simulationMonth) }),
      });
      setSimulationResult(await response.json());
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_34%),#090b13] p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Admin · Historical Backfill</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">補齊歷史月份，不偷看未來。</h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-400">
            RSS 管線適合持續收集近期新聞，不適合回補完整歷史。這裡用來檢查 DB 覆蓋率、匯入 historical backfill metadata，並用指定月份月底作為 asOfDate 產生候選訊號。
          </p>
        </header>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/90 p-6">
            <h2 className="text-2xl font-black">管理密鑰</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">使用 Vercel / Supabase 同一組 admin secret。密鑰只存在這個瀏覽器狀態，不會存入資料庫。</p>
            <input
              value={adminSecret}
              onChange={(event) => setAdminSecret(event.target.value)}
              type="password"
              placeholder="x-admin-secret"
              className="mt-5 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400"
            />
            <button
              type="button"
              onClick={loadCoverage}
              disabled={!adminSecret || loading === "coverage"}
              className="mt-4 rounded-full bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === "coverage" ? "讀取中..." : "讀取資料覆蓋率"}
            </button>
          </div>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/90 p-6">
            <h2 className="text-2xl font-black">覆蓋率總覽</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Metric label="Articles" value={String(coverage?.totals?.articles ?? "-")} />
              <Metric label="Effective Sources" value={String(coverage?.totals?.effectiveSources ?? "-")} />
              <Metric label="Stock Prices" value={String(coverage?.totals?.stockPrices ?? "-")} />
              <Metric label="Market Series" value={String(coverage?.totals?.marketPriceSeries ?? "-")} />
            </div>
            {coverage?.error ? <p className="mt-4 text-sm text-red-300">{coverage.error}</p> : null}
          </div>
        </section>

        {coverage?.rows ? (
          <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950/90 p-6 md:p-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Coverage</p>
                <h2 className="mt-2 text-2xl font-black">2025-01 到 2026-06</h2>
              </div>
              <p className="text-sm text-zinc-600">N/A 代表該資料表或欄位尚未建立。</p>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
                <thead className="text-xs uppercase tracking-widest text-zinc-600">
                  <tr>
                    <th className="px-4 py-2">Month</th>
                    <th className="px-4 py-2">Articles</th>
                    <th className="px-4 py-2">Effective Sources</th>
                    <th className="px-4 py-2">Stock Prices</th>
                    <th className="px-4 py-2">Market Series</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.rows.map((row) => {
                    const needsBackfill = row.researchStatus.code === "backfill_required";
                    return (
                      <tr key={row.month} className="bg-zinc-900/70">
                        <td className="rounded-l-2xl px-4 py-3 font-mono font-black text-white">{row.month}</td>
                        <td className="px-4 py-3 text-zinc-300">{metricText(row.articles)}</td>
                        <td className="px-4 py-3 text-zinc-300">{metricText(row.effectiveSources)}</td>
                        <td className="px-4 py-3 text-zinc-300">{metricText(row.stockPrices)}</td>
                        <td className="px-4 py-3 text-zinc-300">{metricText(row.marketPriceSeries)}</td>
                        <td className="rounded-r-2xl px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${needsBackfill ? "bg-amber-400/10 text-amber-200" : "bg-emerald-400/10 text-emerald-200"}`} title={row.researchStatus.reason}>
                            {row.researchStatus.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/90 p-6">
            <h2 className="text-2xl font-black">Historical News Backfill</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Articles JSON 留白時，系統會用 Google News 月份搜尋自動取得歷史 metadata；貼入 JSON 時則使用手動資料。每次最多回補 31 天，所有結果都會再次檢查發布日期。
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-bold text-zinc-400">
                Start Date
                <input value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-sky-400" />
              </label>
              <label className="text-sm font-bold text-zinc-400">
                End Date
                <input value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-sky-400" />
              </label>
            </div>
            <label className="mt-5 block text-sm font-bold text-zinc-400">
              Queries
              <textarea value={queriesText} onChange={(event) => setQueriesText(event.target.value)} rows={9} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 font-mono text-sm text-white outline-none focus:border-sky-400" />
            </label>
            <label className="mt-5 block text-sm font-bold text-zinc-400">
              Articles JSON（可空白）
              <textarea value={articlesJson} onChange={(event) => setArticlesJson(event.target.value)} placeholder={articleExample} rows={8} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 font-mono text-sm text-white outline-none focus:border-sky-400" />
            </label>
            <button type="button" onClick={runBackfill} disabled={!adminSecret || loading === "backfill"} className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">
              {loading === "backfill" ? "執行中..." : "執行單月歷史回補"}
            </button>
            <ResultBlock value={backfillResult} />
          </div>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/90 p-6">
            <h2 className="text-2xl font-black">Run Monthly Simulation</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">用該月最後一天當作 asOfDate，只讀取當時以前的資料，產生候選市場訊號。</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-bold text-zinc-400">
                Year
                <input value={simulationYear} onChange={(event) => setSimulationYear(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-sky-400" />
              </label>
              <label className="text-sm font-bold text-zinc-400">
                Month
                <input value={simulationMonth} onChange={(event) => setSimulationMonth(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-sky-400" />
              </label>
            </div>
            <button type="button" onClick={runSimulation} disabled={!adminSecret || loading === "simulation"} className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">
              {loading === "simulation" ? "模擬中..." : "Run Month"}
            </button>
            <ResultBlock value={simulationResult} />
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="mt-2 font-mono text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function ResultBlock({ value }: { value: unknown }) {
  if (!value) return null;
  return (
    <pre className="mt-5 max-h-96 overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-xs leading-6 text-zinc-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
