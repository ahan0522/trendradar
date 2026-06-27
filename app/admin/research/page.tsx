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
  dryRun?: boolean;
  source?: string;
  actionCount?: number;
  priceCount?: number;
  symbolCount?: number;
  error?: string;
  migrationRequired?: boolean;
};

const tableLabels: Record<string, string> = {
  stockPrices: "股價資料",
  companyActions: "公司行動",
  industryObservations: "產業觀測",
  commodityQuotes: "商品報價",
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

  async function sync(source: "twse" | "sec", dryRun: boolean) {
    setLoading(`${source}-${dryRun ? "dry" : "write"}`);
    try {
      const response = await fetch(`/api/admin/research/sync-${source}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ dryRun }),
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
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <SourceCard
            title="臺灣證券交易所"
            description="上市公司重大訊息與每日官方成交資料。"
            onDryRun={() => sync("twse", true)}
            onWrite={() => sync("twse", false)}
            disabled={!secret || Boolean(loading)}
            loading={loading.startsWith("twse")}
          />
          <SourceCard
            title="SEC EDGAR"
            description="美股觀察標的的 8-K、10-Q、10-K、6-K、20-F 與 40-F。"
            onDryRun={() => sync("sec", true)}
            onWrite={() => sync("sec", false)}
            disabled={!secret || Boolean(loading)}
            loading={loading.startsWith("sec")}
          />
        </section>

        {result ? (
          <section className={`rounded-3xl border p-6 ${result.ok ? "border-emerald-300/20 bg-emerald-400/5" : "border-rose-300/20 bg-rose-400/5"}`}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Last Operation</p>
            <h2 className="mt-2 text-xl font-black">{result.ok ? `${result.source ?? "資料來源"} ${result.dryRun ? "預覽成功" : "同步成功"}` : "同步失敗"}</h2>
            {result.ok ? (
              <p className="mt-3 text-sm text-zinc-300">
                公司行動 {result.actionCount ?? 0} 筆 · 股價 {result.priceCount ?? 0} 筆 · 公司 {result.symbolCount ?? "-"} 家
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
  loading,
}: {
  title: string;
  description: string;
  onDryRun: () => void;
  onWrite: () => void;
  disabled: boolean;
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
        <button type="button" onClick={onWrite} disabled={disabled} className="rounded-full bg-sky-300 px-4 py-2 text-sm font-black text-zinc-950 disabled:opacity-40">
          正式同步
        </button>
      </div>
    </article>
  );
}
