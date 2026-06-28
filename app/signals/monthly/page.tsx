import Link from "next/link";
import { getMonthlySignalReport } from "@/lib/signals/monthly-signals";

export const dynamic = "force-dynamic";

type MonthlySignal = Awaited<ReturnType<typeof getMonthlySignalReport>>["rows"][number]["signals"][number];

function statusLabel(status: string) {
  if (status === "candidate_ready") return "已有月度候選";
  if (status === "no_candidate") return "有資料但未成訊號";
  return "Backfill Required";
}

function statusTone(status: string) {
  if (status === "candidate_ready") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-200";
  if (status === "no_candidate") return "border-amber-300/30 bg-amber-400/10 text-amber-200";
  return "border-amber-300/30 bg-amber-400/10 text-amber-200";
}

function marketLabel(value: string) {
  const labels: Record<string, string> = {
    US: "美股",
    TW: "台股",
    KR: "韓股",
    JP: "日股",
    GLOBAL: "全球",
  };
  return labels[value] ?? value;
}

function evidenceText(signal: MonthlySignal) {
  const evidence = signal.evidence[0] as {
    article_count?: number;
    source_count?: number;
    sample_titles?: string[];
    heat_state_label?: string;
    heat_reason?: string;
    discovery_mode?: string;
  };
  return {
    articleCount: evidence.article_count ?? 0,
    sourceCount: evidence.source_count ?? 0,
    samples: evidence.sample_titles ?? [],
    heatStateLabel: evidence.heat_state_label,
    heatReason: evidence.heat_reason,
    discoveryMode: evidence.discovery_mode,
  };
}

function formatPct(value: number) {
  const normalized = Number(value);
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(2)}%`;
}

function outcomeLabel(value: string) {
  if (value === "success") return "成立";
  if (value === "partial") return "部分成立";
  if (value === "failed") return "未成立";
  return "待驗證";
}

export default async function MonthlySignalsPage() {
  const report = await getMonthlySignalReport({
    startMonth: "2025-01",
    endMonth: "2026-06",
  });
  const readyRows = report.rows.filter((row) => row.status === "candidate_ready");
  const missingRows = report.rows.filter((row) => row.status === "no_data");

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_34%),#090b13] p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Monthly Time Machine</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">一個月一個月建立市場訊號。</h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-400">
            每個月份都只使用該月截至 asOfDate 已經發布的資訊，不使用未來資料。月份結束後，這些候選訊號才會進入 30D / 60D / 90D / 180D 回測。
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <MiniMetric label="月份範圍" value={`${report.startMonth} → ${report.endMonth}`} />
            <MiniMetric label="有候選月份" value={String(readyRows.length)} tone="text-emerald-300" />
            <MiniMetric label="需 Backfill 月份" value={String(missingRows.length)} tone="text-amber-300" />
            <MiniMetric label="資料日期" value={report.generatedAt.slice(0, 10)} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signals" className="rounded-full bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-sky-100">
              回到市場訊號
            </Link>
            <Link href="/api/signals/monthly" className="rounded-full border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:border-sky-400/60">
              查看 JSON
            </Link>
          </div>
        </header>

        <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950/90 p-6 md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Coverage</p>
              <h2 className="mt-2 text-2xl font-black">月份資料狀態</h2>
            </div>
            <p className="text-sm text-zinc-600">Backfill Required 代表目前 Supabase 尚未補齊該月歷史資料，不代表資料不存在。</p>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {report.rows.map((row) => (
              <div key={row.month} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <p className="font-mono text-lg font-black text-white">{row.month}</p>
                <p className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusTone(row.status)}`}>
                  {statusLabel(row.status)}
                </p>
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  文章 {row.articleCount} 篇
                  <br />
                  asOf {row.asOfDate}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          {readyRows.map((row) => (
            <article key={row.month} className="rounded-[2rem] border border-zinc-800 bg-zinc-950/90 p-6 md:p-8">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Month {row.month}</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight">截至 {row.asOfDate} 的月度候選</h2>
                  <p className="mt-2 text-sm text-zinc-500">只使用這個月份當下已知資料。</p>
                </div>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-200">
                  {row.signalCount} 個候選
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {row.signals.map((signal) => {
                  const evidence = evidenceText(signal);
                  return (
                    <div key={signal.id} className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Strength {signal.signalStrength} · Confidence {signal.confidenceScore}</p>
                          <h3 className="mt-2 text-2xl font-black text-white">{signal.topic}</h3>
                          <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-400">{signal.hypothesis}</p>
                          {evidence.heatStateLabel ? (
                            <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-400/5 p-3">
                              <p className="text-xs font-black text-sky-200">{evidence.heatStateLabel}</p>
                              <p className="mt-1 text-xs leading-5 text-zinc-500">{evidence.heatReason}</p>
                            </div>
                          ) : null}
                          {signal.latestOutcome ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
                                {signal.latestOutcome.horizon_days}D {outcomeLabel(signal.latestOutcome.outcome)}
                              </span>
                              <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-300">
                                Basket {formatPct(signal.latestOutcome.basket_return)}
                              </span>
                              <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-300">
                                Alpha {formatPct(signal.latestOutcome.excess_return)}
                              </span>
                            </div>
                          ) : (
                            <p className="mt-4 text-xs font-bold text-amber-300">價格與基準資料尚待驗證</p>
                          )}
                        </div>
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                          <p>當月文章：<span className="font-black text-white">{evidence.articleCount}</span></p>
                          <p className="mt-1">來源數：<span className="font-black text-white">{evidence.sourceCount}</span></p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">樣本標題</p>
                          <div className="mt-3 space-y-2">
                            {evidence.samples.slice(0, 4).map((title) => (
                              <p key={title} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 text-sm leading-6 text-zinc-300">
                                {title}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">需觀察標的</p>
                          {(signal.watchlists ?? []).length > 0 ? (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {(signal.watchlists ?? []).slice(0, 6).map((item) => (
                                <div key={`${item.symbol}-${item.market}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
                                  <p className="font-black text-white">{item.companyName || item.symbol}</p>
                                  <p className="mt-1 text-xs text-zinc-500">{marketLabel(item.market)} · {item.symbol}</p>
                                  <p className="mt-2 text-xs leading-5 text-zinc-600">{item.thesis}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-400/5 p-4">
                              <p className="text-sm font-bold text-amber-200">尚未建立可靠的受惠公司映射</p>
                              <p className="mt-2 text-xs leading-5 text-zinc-500">
                                先保留為產業研究候選；等公司公告、營收曝險或供應鏈資料能支持因果關係後，才加入觀察標的。
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-5 border-t border-zinc-800 pt-4">
                        <Link href={`/signals/${signal.id}`} className="text-sm font-black text-sky-300 transition hover:text-sky-200">
                          查看完整證據、觀察籃子與回測 →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function MiniMetric({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={`mt-2 font-mono text-lg font-black ${tone}`}>{value}</p>
    </div>
  );
}

