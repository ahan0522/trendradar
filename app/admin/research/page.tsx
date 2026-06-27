"use client";

import { useState } from "react";

type TableQuality = {
  available: boolean;
  total: number | null;
  verified: number | null;
  needsReview: number | null;
  latestAt: string | null;
  error?: string;
};

type QualityResponse = {
  ok: boolean;
  migrationRequired: string[];
  tables: Record<string, TableQuality>;
  issues: string[];
};

type SyncResponse = {
  ok: boolean;
  skipped?: boolean;
  dryRun?: boolean;
  providerMode?: string;
  reason?: string;
  source?: string;
  actionCount?: number;
  priceCount?: number;
  symbolCount?: number;
  commodityQuoteCount?: number;
  industryObservationCount?: number;
  error?: string;
  migrationRequired?: boolean;
};

const migrationUrl = "https://github.com/ahan0522/trendradar/blob/main/supabase/migrations/20260627143000_research_data_foundation.sql";
const supabaseSqlEditorUrl = "https://supabase.com/dashboard/project/_/sql/new";

const tableLabels: Record<string, string> = {
  stockPrices: "股價資料",
  companyActions: "公司行動",
  industryObservations: "產業觀測",
  commodityQuotes: "商品報價",
  signalEvidence: "訊號證據鏈",
  scoreComponents: "分數組成",
  signalTimeline: "訊號時間軸",
  signalLessons: "驗證反思",
};

export default function ResearchAdminPage() {
  const [secret, setSecret] = useState("");
  const [quality, setQuality] = useState<QualityResponse | null>(null);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [loading, setLoading] = useState("");

  function headers() {
    return {
      "content-type": "application/json",
      "x-admin-secret": secret,
    };
  }

  async function loadQuality() {
    setLoading("quality");
    setResult(null);
    try {
      const response = await fetch("/api/admin/research/quality", { headers: headers() });
      setQuality((await response.json()) as QualityResponse);
    } finally {
      setLoading("");
    }
  }

  async function sync(source: "twse" | "sec" | "fred", dryRun: boolean) {
    setLoading(`${source}-${dryRun ? "dry" : "write"}`);
    try {
      const response = await fetch(`/api/admin/research/sync-${source}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(source === "fred" ? { dryRun, startDate: "2025-01-01" } : { dryRun }),
      });
      const payload = (await response.json()) as SyncResponse;
      setResult(payload);
      if (payload.ok && !dryRun) await loadQuality();
    } finally {
      setLoading("");
    }
  }

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.2),_transparent_34%),#090b13] p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-300">Research Data Operations</p>
          <h1 className="mt-3 text-4xl font-black">研究資料控制台</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
            先檢查資料庫，再 dry-run 官方來源。只有日期、來源與品質檢查都通過後，才正式寫入 Signal Ledger 的研究資料。
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="Admin Secret"
              className="min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-sky-400"
            />
            <button
              type="button"
              onClick={loadQuality}
              disabled={!secret || Boolean(loading)}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 disabled:opacity-40"
            >
              {loading === "quality" ? "檢查中..." : "檢查資料品質"}
            </button>
          </div>
        </header>

        {quality ? (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Database Readiness</p>
                <h2 className="mt-2 text-2xl font-black">{quality.ok ? "資料庫已可寫入" : "資料庫尚未完成"}</h2>
              </div>
              <span className={`rounded-full px-4 py-2 text-xs font-black ${quality.ok ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200"}`}>
                {quality.ok ? "READY" : "MIGRATION REQUIRED"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(quality.tables).map(([key, table]) => (
                <div key={key} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <p className="text-sm font-black">{tableLabels[key] ?? key}</p>
                  <p className="mt-3 font-mono text-3xl font-black">{table.total ?? "-"}</p>
                  <p className="mt-2 text-xs text-zinc-500">verified {table.verified ?? "-"} · review {table.needsReview ?? "-"}</p>
                  <p className="mt-1 truncate text-xs text-zinc-600">{table.latestAt ?? table.error ?? "尚無資料"}</p>
                </div>
              ))}
            </div>

            {quality.issues.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-100">
                {quality.issues.map((issue) => <p key={issue}>{issue}</p>)}
              </div>
            ) : null}

            {!quality.ok ? (
              <div className="mt-5 rounded-2xl border border-sky-300/20 bg-sky-400/5 p-5">
                <p className="font-black text-sky-100">只差一次資料庫啟用</p>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  在 Supabase SQL Editor 執行研究資料 migration，回到本頁再按一次「檢查資料品質」。完成前正式同步會保持停用，避免半套資料寫入。
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={migrationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-sky-300/30 px-4 py-2 text-sm font-bold text-sky-200"
                  >
                    開啟 migration SQL
                  </a>
                  <a
                    href={supabaseSqlEditorUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-sky-300 px-4 py-2 text-sm font-black text-zinc-950"
                  >
                    開啟 Supabase SQL Editor
                  </a>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          <SourceCard
            title="臺灣證券交易所"
            description="上市公司重大訊息與每日官方成交資料。"
            onDryRun={() => sync("twse", true)}
            onWrite={() => sync("twse", false)}
            disabled={!secret || Boolean(loading)}
            writeDisabled={!quality?.ok}
            loading={loading.startsWith("twse")}
          />
          <SourceCard
            title="SEC EDGAR"
            description="美股觀察標的的 8-K、10-Q、10-K、6-K、20-F 與 40-F。"
            onDryRun={() => sync("sec", true)}
            onWrite={() => sync("sec", false)}
            disabled={!secret || Boolean(loading)}
            writeDisabled={!quality?.ok}
            loading={loading.startsWith("sec")}
          />
          <SourceCard
            title="FRED"
            description="天然氣、銅製品價格指數與高科技製造產能利用率。"
            onDryRun={() => sync("fred", true)}
            onWrite={() => sync("fred", false)}
            disabled={!secret || Boolean(loading)}
            writeDisabled={!quality?.ok}
            loading={loading.startsWith("fred")}
          />
        </section>

        {result ? (
          <section className={`rounded-3xl border p-6 ${
            result.skipped
              ? "border-amber-300/20 bg-amber-400/5"
              : result.ok
                ? "border-emerald-300/20 bg-emerald-400/5"
                : "border-rose-300/20 bg-rose-400/5"
          }`}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Last Operation</p>
            <h2 className="mt-2 text-xl font-black">
              {result.skipped
                ? "資料來源尚未啟用"
                : result.ok
                  ? `${result.source ?? "資料來源"} ${result.dryRun ? "預覽成功" : "同步成功"}`
                  : "同步失敗"}
            </h2>
            {result.skipped ? (
              <p className="mt-3 text-sm leading-7 text-amber-100">{result.reason}</p>
            ) : result.ok ? (
              <p className="mt-3 text-sm text-zinc-300">
                公司行動 {result.actionCount ?? 0} 筆 · 股價 {result.priceCount ?? 0} 筆 · 公司 {result.symbolCount ?? "-"} 家
                {result.commodityQuoteCount !== undefined ? ` · 商品報價 ${result.commodityQuoteCount} 筆` : ""}
                {result.industryObservationCount !== undefined ? ` · 產業觀測 ${result.industryObservationCount} 筆` : ""}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-7 text-rose-100">{result.error}</p>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function SourceCard({
  title,
  description,
  onDryRun,
  onWrite,
  disabled,
  writeDisabled,
  loading,
}: {
  title: string;
  description: string;
  onDryRun: () => void;
  onWrite: () => void;
  disabled: boolean;
  writeDisabled: boolean;
  loading: boolean;
}) {
  return (
    <article className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-zinc-500">{description}</p>
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={onDryRun} disabled={disabled} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-bold disabled:opacity-40">
          {loading ? "處理中..." : "先預覽"}
        </button>
        <button
          type="button"
          onClick={onWrite}
          disabled={disabled || writeDisabled}
          title={writeDisabled ? "請先完成資料庫 migration 並重新檢查" : undefined}
          className="rounded-full bg-sky-300 px-4 py-2 text-sm font-black text-zinc-950 disabled:opacity-40"
        >
          正式同步
        </button>
      </div>
    </article>
  );
}
