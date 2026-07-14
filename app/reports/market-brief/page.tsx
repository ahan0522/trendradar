import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarDays, CircleAlert, Minus } from "lucide-react";
import { getStoredOrLiveMarketBrief } from "@/lib/reports/market-brief-snapshots";
import { formatTaipeiTimestamp } from "@/lib/reports/market-brief-format";
import type {
  FxRateSummary,
  InstitutionalFlowSummary,
  MarginTradingSummary,
  MarketBrief,
  MarketBriefOutlook,
  MarketBriefPeriod,
  MarketBriefSection,
  MarketBriefStatus,
  OptionsSentimentSummary,
  TaiwanFuturesPositioning,
} from "@/types/market-report";

export const dynamic = "force-dynamic";

const periodLabels: Record<MarketBriefPeriod, string> = {
  daily: "每日報告",
  weekly: "每週報告",
  monthly: "每月報告",
};

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : currentTaipeiDate();
}

function periodHref(period: MarketBriefPeriod, asOfDate: string) {
  return `/reports/market-brief?period=${period}&asOfDate=${asOfDate}`;
}

function statusText(status: MarketBriefStatus) {
  if (status === "ready") return "資料完整";
  if (status === "partial") return "部分資料";
  return "等待資料";
}

function statusClass(status: MarketBriefStatus) {
  if (status === "ready") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "partial") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  return "border-zinc-700 bg-zinc-900 text-zinc-500";
}

function biasText(outlook: MarketBriefOutlook) {
  if (outlook.bias === "constructive") return "偏多觀察";
  if (outlook.bias === "cautious") return "偏空觀察";
  if (outlook.bias === "mixed") return "多空交錯";
  return "資料不足";
}

function biasClass(outlook: MarketBriefOutlook) {
  if (outlook.bias === "constructive") return "text-emerald-300";
  if (outlook.bias === "cautious") return "text-rose-300";
  if (outlook.bias === "mixed") return "text-amber-200";
  return "text-zinc-500";
}

function signedPercent(value: number | null) {
  if (value === null) return "待補";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function signedAmount(value: number | null, decimals = 2) {
  if (value === null) return "待補";
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}`;
}

function compactAmount(value: number | null, unit?: "shares" | "twd") {
  if (value === null) return "待補";
  const sign = value > 0 ? "+" : "";
  const absolute = Math.abs(value);
  if (unit === "shares") {
    if (absolute >= 100_000_000) return `${sign}${(value / 100_000_000).toFixed(2)} 億股`;
    if (absolute >= 10_000) return `${sign}${(value / 10_000).toFixed(1)} 萬股`;
    return `${sign}${value.toLocaleString("zh-TW")} 股`;
  }
  if (unit === "twd") {
    if (absolute >= 100_000_000) return `${sign}${(value / 100_000_000).toFixed(2)} 億元`;
    if (absolute >= 10_000) return `${sign}${(value / 10_000).toFixed(1)} 萬元`;
    return `${sign}${value.toLocaleString("zh-TW")} 元`;
  }
  return `${sign}${value.toLocaleString("zh-TW")}`;
}

async function loadBrief(period: MarketBriefPeriod, asOfDate: string) {
  try {
    const report = await getStoredOrLiveMarketBrief({ period, asOfDate });
    return { brief: report.brief, snapshot: report.snapshot, error: "" };
  } catch (cause) {
    return { brief: null, snapshot: null, error: cause instanceof Error ? cause.message : "報告暫時無法產生" };
  }
}

export default async function MarketBriefPage({ searchParams }: {
  searchParams: Promise<{ period?: string; asOfDate?: string }>;
}) {
  const params = await searchParams;
  const period = (["daily", "weekly", "monthly"].includes(params.period ?? "") ? params.period : "daily") as MarketBriefPeriod;
  const asOfDate = validDate(params.asOfDate);
  const { brief, snapshot, error } = await loadBrief(period, asOfDate);

  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-6 text-zinc-100 md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Market Brief</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">台股與美股市場觀察</h1>
            </div>
            <form className="flex items-center gap-2" action="/reports/market-brief">
              <input type="hidden" name="period" value={period} />
              <label className="sr-only" htmlFor="asOfDate">報告日期</label>
              <input id="asOfDate" name="asOfDate" type="date" defaultValue={asOfDate} className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200" />
              <button className="h-10 rounded-md bg-white px-4 text-sm font-black text-zinc-950 hover:bg-cyan-100">查詢</button>
            </form>
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            {(["daily", "weekly", "monthly"] as const).map((item) => (
              <Link key={item} href={periodHref(item, asOfDate)} className={`rounded-md px-4 py-2 text-sm font-black transition ${item === period ? "bg-cyan-300 text-zinc-950" : "border border-zinc-700 text-zinc-400 hover:text-white"}`}>
                {periodLabels[item]}
              </Link>
            ))}
          </div>
        </header>
        {error || !brief ? <ErrorState message={error} /> : <Report brief={brief} revision={snapshot?.revision ?? null} />}
      </div>
    </main>
  );
}

function Report({ brief, revision }: { brief: MarketBrief; revision: number | null }) {
  return (
    <>
      <MarketSection section={brief.taiwan} outlook={brief.outlook.taiwan} />

      <section className="grid gap-6 border-b border-zinc-800 py-8 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-zinc-500">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{brief.asOfDate}</span>
            <span>{brief.reportWindow.startDate} 至 {brief.reportWindow.endDate}</span>
            <span>{brief.reportVersion}</span>
            <span>{revision ? `固定快照 r${revision}` : "即時預覽"}</span>
            <span>最後更新 {formatTaipeiTimestamp(brief.generatedAt)}</span>
          </div>
          <h2 className="mt-5 text-2xl font-black md:text-3xl">{brief.title}</h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-zinc-300">{brief.executiveSummary}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-[#0d1016] p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">資料原則</p>
          <p className="mt-3 text-sm leading-7 text-zinc-400">{brief.dataPolicy.caveat}</p>
          <p className="mt-3 text-xs leading-6 text-zinc-600">{brief.outlook.caveat}</p>
        </div>
      </section>

      <section className="border-b border-zinc-800 py-8">
        <SectionHeading eyebrow="Tomorrow / Next Week" title="下一交易期先看這些" />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <OutlookPanel title="台股" outlook={brief.outlook.taiwan} />
          <OutlookPanel title="美股" outlook={brief.outlook.us} />
        </div>
      </section>

      <MarketSection section={brief.us} outlook={brief.outlook.us} />

      <section className="border-b border-zinc-800 py-8">
        <SectionHeading eyebrow="Signals" title="目前值得追蹤的研究方向" />
        {brief.signals.length > 0 ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {brief.signals.map((signal) => (
              <article key={signal.id} className="rounded-lg border border-zinc-800 bg-[#0d1016] p-5">
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge status={signal.status} />
                  <span className="font-mono text-xs text-zinc-600">Heat {signal.signalStrength.toFixed(0)} · Confidence {signal.confidenceScore.toFixed(0)}</span>
                </div>
                <h3 className="mt-4 text-xl font-black">{signal.topic}</h3>
                <div className="mt-4 space-y-3">
                  {signal.watchlist.length > 0 ? signal.watchlist.map((item) => (
                    <div key={`${signal.id}-${item.market}-${item.symbol}`} className="border-t border-zinc-800 pt-3">
                      <div className="flex items-baseline justify-between gap-3"><strong className="text-sm">{item.companyName}</strong><span className="font-mono text-xs text-cyan-300">{item.symbol}</span></div>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{item.reason}</p>
                    </div>
                  )) : <p className="text-sm text-zinc-600">尚無符合因果門檻的注意標的。</p>}
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyLine text="目前尚未形成通過內部門檻的七月 Signal。" />}
      </section>

      <section className="py-8">
        <SectionHeading eyebrow="Audit" title="資料完整度與尚待補齊" />
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {brief.dataQuality.map((item) => (
            <div key={item.label} className="rounded-lg border border-zinc-800 bg-[#0d1016] p-4">
              <div className="flex items-center justify-between gap-3"><strong className="text-sm">{item.label}</strong><StatusBadge status={item.status} /></div>
              <p className="mt-3 font-mono text-xs text-zinc-500">Coverage {item.coverage}</p>
              {item.reason ? <p className="mt-2 text-xs leading-5 text-zinc-600">{item.reason}</p> : null}
            </div>
          ))}
        </div>
        <details className="mt-5 rounded-lg border border-zinc-800 bg-[#0d1016] p-5">
          <summary className="cursor-pointer text-sm font-black text-zinc-300">查看全部資料缺口</summary>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-500">{brief.dataGaps.map((gap) => <li key={gap}>• {gap}</li>)}</ul>
        </details>
      </section>
    </>
  );
}

function OutlookPanel({ title, outlook }: { title: string; outlook: MarketBriefOutlook }) {
  return (
    <article className="rounded-lg border border-zinc-800 bg-[#0d1016] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold text-zinc-500">{title}研判</p><h3 className={`mt-1 text-2xl font-black ${biasClass(outlook)}`}>{biasText(outlook)}</h3></div>
        <span className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-bold text-zinc-400">信心 {outlook.confidence === "medium" ? "中" : outlook.confidence === "low" ? "低" : "待定"}</span>
      </div>
      <p className="mt-4 text-sm leading-7 text-zinc-400">{outlook.summary}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <EvidenceList title="支持證據" items={outlook.positiveEvidence} tone="text-emerald-300" />
        <EvidenceList title="反向證據" items={outlook.negativeEvidence} tone="text-rose-300" />
      </div>
      <EvidenceList title="下一交易期觀察" items={outlook.nextSessionFocus} tone="text-cyan-300" className="mt-5" />
    </article>
  );
}

function MarketSection({ section, outlook }: { section: MarketBriefSection; outlook: MarketBriefOutlook }) {
  return (
    <section className="border-b border-zinc-800 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3"><SectionHeading eyebrow={section.market} title={section.title} /><p className={`text-sm font-black ${biasClass(outlook)}`}>{biasText(outlook)}</p></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {section.indices.map((index) => {
          // VIX is a fear gauge: rising is bad news for equities, so its
          // color/arrow polarity is the inverse of every other index here.
          const isInverseVolatility = index.symbol === "^VIX";
          const rawPositive = (index.changePct ?? 0) > 0;
          const rawNegative = (index.changePct ?? 0) < 0;
          const positive = isInverseVolatility ? rawNegative : rawPositive;
          const negative = isInverseVolatility ? rawPositive : rawNegative;
          return (
            <article key={index.symbol} className="rounded-lg border border-zinc-800 bg-[#0d1016] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-zinc-400">{index.label}</p>
                    {index.dataTier === "provisional" ? <span className="rounded border border-amber-300/30 px-1.5 py-0.5 text-[10px] font-black text-amber-200">單一來源</span> : null}
                  </div>
                  <p className="mt-2 font-mono text-xl font-black">{index.close?.toLocaleString("zh-TW") ?? "—"}</p>
                </div>
                {positive ? <ArrowUpRight className="h-5 w-5 text-emerald-300" /> : negative ? <ArrowDownRight className="h-5 w-5 text-rose-300" /> : <Minus className="h-5 w-5 text-zinc-600" />}
              </div>
              <p className={`mt-3 font-mono text-sm font-black ${positive ? "text-emerald-300" : negative ? "text-rose-300" : "text-zinc-600"}`}>
                {index.changePct === null ? "待補" : (
                  <>
                    {signedPercent(index.changePct)}
                    <span className="ml-2 text-xs font-normal text-zinc-500">{signedAmount(index.changePoint)} 點</span>
                  </>
                )}
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-600">{index.streakLabel}</p>
            </article>
          );
        })}
      </div>
      {section.institutionalFlows ? <InstitutionFlows flows={section.institutionalFlows} /> : null}
      {section.futuresPositioning ? <FuturesPositioning items={section.futuresPositioning} /> : null}
      {section.marginTrading ? <MarginTrading margin={section.marginTrading} /> : null}
      {section.optionsSentiment ? <OptionsSentiment options={section.optionsSentiment} /> : null}
      {section.fxRate ? <FxRate fx={section.fxRate} /> : null}
      {/* US sector/theme movers temporarily hidden -- indices only for now
          while TW data quality work is prioritized; the underlying data and
          outlook evidence computation are untouched, just not rendered. */}
      <div className={`mt-7 grid gap-4 lg:grid-cols-2 ${section.market === "US" ? "hidden" : ""}`}>
        {section.sectors.map((sector) => (
          <article key={`${section.market}-${sector.label}`} className="rounded-lg border border-zinc-800 bg-[#0d1016] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-600">Sector / Theme</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black">{sector.label}</h3>
                  {sector.dataTier === "provisional" ? <span className="rounded border border-amber-300/30 px-1.5 py-0.5 text-[10px] font-black text-amber-200">單一來源</span> : null}
                </div>
              </div>
              <span className="text-right">
                <span className={`font-mono text-lg font-black ${sector.direction === "up" ? "text-emerald-300" : sector.direction === "down" ? "text-rose-300" : "text-zinc-600"}`}>{signedPercent(sector.changePct)}</span>
                <span className="ml-2 font-mono text-xs text-zinc-500">{signedAmount(sector.changePoint)}{section.market === "TW" ? " 元" : " USD"}</span>
              </span>
            </div>
            {sector.topStocks.length > 0 ? (
              <div className="mt-4 divide-y divide-zinc-800 border-t border-zinc-800">
                {sector.topStocks.map((stock) => (
                  <div key={`${sector.label}-${stock.symbol}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span><strong>{stock.companyName}</strong><span className="ml-2 font-mono text-xs text-zinc-600">{stock.symbol}</span></span>
                    <span className="text-right">
                      <span className="font-mono text-zinc-300">{signedPercent(stock.changePct)}</span>
                      <span className="ml-2 font-mono text-xs text-zinc-500">{signedAmount(stock.changePoint)}{section.market === "TW" ? "元" : "$"}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : <EmptyLine text={sector.reason ?? "尚待補充可信產業資料。"} compact />}
          </article>
        ))}
      </div>
    </section>
  );
}

function InstitutionFlows({ flows }: { flows: InstitutionalFlowSummary[] }) {
  return (
    <div className="mt-7">
      <h3 className="text-sm font-black text-zinc-300">法人資金流</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {flows.map((flow) => (
          <div key={flow.label} className="rounded-lg border border-zinc-800 bg-[#0d1016] p-4">
            <div className="flex items-center justify-between gap-2"><strong className="text-sm">{flow.label}</strong><StatusBadge status={flow.status} /></div>
            <p className={`mt-3 font-mono text-lg font-black ${flow.direction === "buy" ? "text-emerald-300" : flow.direction === "sell" ? "text-rose-300" : "text-zinc-600"}`}>{compactAmount(flow.singleDayAmount, flow.unit)}</p>
            <p className="mt-1 text-[11px] text-zinc-600">買 {compactAmount(flow.singleDayBuyAmount, flow.unit)} ／ 賣 {compactAmount(flow.singleDaySellAmount, flow.unit)}</p>
            <p className="mt-2 text-xs text-zinc-500">區間累積 {compactAmount(flow.cumulativeAmount, flow.unit)}</p>
            <p className="mt-1 text-[11px] text-zinc-600">累積買 {compactAmount(flow.cumulativeBuyAmount, flow.unit)} ／ 累積賣 {compactAmount(flow.cumulativeSellAmount, flow.unit)}</p>
            <p className="mt-1 text-xs text-zinc-600">連續 {flow.consecutiveDays ?? "—"} 日</p>
            {flow.topStocks?.length ? (
              <div className="mt-3 border-t border-zinc-800 pt-3">
                <p className="text-[11px] font-black text-zinc-600">當日主要買賣超</p>
                <div className="mt-2 space-y-1.5">
                  {flow.topStocks.slice(0, 3).map((stock) => (
                    <div key={`${flow.label}-${stock.symbol}`} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-zinc-500">{stock.companyName}</span>
                      <span className={stock.netAmount >= 0 ? "font-mono text-emerald-300" : "font-mono text-rose-300"}>
                        {compactAmount(stock.netAmount, stock.unit)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function FuturesPositioning({ items }: { items: TaiwanFuturesPositioning[] }) {
  return (
    <div className="mt-7">
      <h3 className="text-sm font-black text-zinc-300">台指期三大法人未平倉</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.investor} className="rounded-lg border border-zinc-800 bg-[#0d1016] p-4">
            <div className="flex items-center justify-between gap-2"><strong className="text-sm">{item.investor}</strong><StatusBadge status={item.status} /></div>
            <p className={`mt-3 font-mono text-lg font-black ${item.direction === "net_long" ? "text-emerald-300" : item.direction === "net_short" ? "text-rose-300" : "text-zinc-600"}`}>
              淨 {item.netContracts !== null ? `${item.netContracts >= 0 ? "+" : ""}${item.netContracts.toLocaleString("zh-TW")}` : "待補"} 口
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">多單 {item.longContracts?.toLocaleString("zh-TW") ?? "待補"} 口 ／ 空單 {item.shortContracts?.toLocaleString("zh-TW") ?? "待補"} 口</p>
            {item.reason ? <p className="mt-2 text-xs leading-5 text-zinc-600">{item.reason}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function MarginTrading({ margin }: { margin: MarginTradingSummary }) {
  if (margin.status === "pending") return null;
  return (
    <div className="mt-7">
      <h3 className="text-sm font-black text-zinc-300">融資融券餘額（上市）</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-[#0d1016] p-4">
          <strong className="text-sm">融資餘額</strong>
          <p className="mt-3 font-mono text-lg font-black text-zinc-200">{compactAmount(margin.marginBalanceAmountTwd, "twd")}</p>
          <p className="mt-1 text-[11px] text-zinc-600">{compactAmount(margin.marginBalanceChangeAmountTwd, "twd")}（單日）</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-[#0d1016] p-4">
          <strong className="text-sm">融券餘額</strong>
          <p className="mt-3 font-mono text-lg font-black text-zinc-200">{margin.shortBalanceLots?.toLocaleString("zh-TW") ?? "待補"} 張</p>
          <p className="mt-1 text-[11px] text-zinc-600">{signedAmount(margin.shortBalanceChangeLots, 0)} 張（單日）</p>
        </div>
      </div>
      {margin.reason ? <p className="mt-2 text-xs leading-5 text-zinc-600">{margin.reason}</p> : null}
    </div>
  );
}

function OptionsSentiment({ options }: { options: OptionsSentimentSummary }) {
  if (options.status === "pending") return null;
  return (
    <div className="mt-7">
      <h3 className="text-sm font-black text-zinc-300">臺指選擇權 Put/Call 比</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-[#0d1016] p-4">
          <strong className="text-sm">成交量比</strong>
          <p className="mt-3 font-mono text-lg font-black text-zinc-200">
            {options.putCallVolumeRatioPct?.toFixed(2) ?? "待補"}%
            {options.putCallVolumeRatioChangePct !== null ? (
              <span className="ml-1.5 text-xs font-normal text-zinc-500">
                （{options.comparisonLabel} {signedAmount(options.putCallVolumeRatioChangePct)}）
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-[11px] text-zinc-600">Put {options.putVolume?.toLocaleString("zh-TW") ?? "—"} ／ Call {options.callVolume?.toLocaleString("zh-TW") ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-[#0d1016] p-4">
          <strong className="text-sm">未平倉比</strong>
          <p className="mt-3 font-mono text-lg font-black text-zinc-200">
            {options.putCallOiRatioPct?.toFixed(2) ?? "待補"}%
            {options.putCallOiRatioChangePct !== null ? (
              <span className="ml-1.5 text-xs font-normal text-zinc-500">
                （{options.comparisonLabel} {signedAmount(options.putCallOiRatioChangePct)}）
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-[11px] text-zinc-600">Put {options.putOpenInterest?.toLocaleString("zh-TW") ?? "—"} ／ Call {options.callOpenInterest?.toLocaleString("zh-TW") ?? "—"}</p>
        </div>
      </div>
      {options.reason ? <p className="mt-2 text-xs leading-5 text-zinc-600">{options.reason}</p> : null}
    </div>
  );
}

function FxRate({ fx }: { fx: FxRateSummary }) {
  if (fx.status === "pending") return null;
  return (
    <div className="mt-7">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-black text-zinc-300">{fx.pair} 匯率</h3>
        {fx.dataTier === "provisional" ? <span className="rounded border border-amber-300/30 px-1.5 py-0.5 text-[10px] font-black text-amber-200">單一來源</span> : null}
      </div>
      <p className="mt-3 font-mono text-lg font-black text-zinc-200">{fx.rate?.toFixed(3) ?? "待補"}</p>
      <p className="mt-1 text-[11px] text-zinc-600">{signedAmount(fx.changeAmount, 4)}（{signedPercent(fx.changePct)}）</p>
      {fx.reason ? <p className="mt-2 text-xs leading-5 text-zinc-600">{fx.reason}</p> : null}
    </div>
  );
}

function EvidenceList({ title, items, tone, className = "" }: { title: string; items: string[]; tone: string; className?: string }) {
  return <div className={className}><h4 className="text-xs font-black uppercase tracking-[0.16em] text-zinc-600">{title}</h4>{items.length > 0 ? <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-400">{items.map((item) => <li key={item} className="flex gap-2"><span className={tone}>•</span><span>{item}</span></li>)}</ul> : <p className="mt-2 text-sm text-zinc-700">目前沒有。</p>}</div>;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-600">{eyebrow}</p><h2 className="mt-2 text-2xl font-black">{title}</h2></div>;
}

function StatusBadge({ status }: { status: MarketBriefStatus }) {
  return <span className={`rounded-md border px-2 py-1 text-[11px] font-black ${statusClass(status)}`}>{statusText(status)}</span>;
}

function EmptyLine({ text, compact = false }: { text: string; compact?: boolean }) {
  return <p className={`${compact ? "mt-4" : "mt-5"} rounded-lg border border-dashed border-zinc-800 px-4 py-5 text-sm leading-6 text-zinc-600`}>{text}</p>;
}

function ErrorState({ message }: { message: string }) {
  return <section className="my-10 rounded-lg border border-rose-400/20 bg-rose-400/5 p-6"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 text-rose-300" /><div><h2 className="font-black text-rose-200">報告暫時無法產生</h2><p className="mt-2 text-sm leading-6 text-rose-100/60">{message}</p></div></div></section>;
}
