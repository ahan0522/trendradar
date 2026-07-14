import Link from "next/link";
import { getStoredOrLiveMarketBrief } from "@/lib/reports/market-brief-snapshots";
import {
  biasText,
  compactAmount,
  signedAmount,
  signedPercent,
  statusText,
} from "@/lib/reports/market-brief-format";
import type {
  FxRateSummary,
  InstitutionalFlowSummary,
  MarginTradingSummary,
  MarketBrief,
  MarketBriefOutlook,
  MarketBriefPeriod,
  MarketBriefSection,
  MarketSectorMove,
  OptionsSentimentSummary,
  TaiwanFuturesPositioning,
} from "@/types/market-report";

export const dynamic = "force-dynamic";

const periodLabels: Record<MarketBriefPeriod, string> = {
  daily: "每日",
  weekly: "每週",
  monthly: "每月",
};

const biasDot: Record<MarketBriefOutlook["bias"], string> = {
  constructive: "bg-emerald-500",
  cautious: "bg-rose-500",
  mixed: "bg-amber-500",
  pending: "bg-slate-300",
};

const biasTextColor: Record<MarketBriefOutlook["bias"], string> = {
  constructive: "text-emerald-700",
  cautious: "text-rose-700",
  mixed: "text-amber-700",
  pending: "text-slate-500",
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
  return `/brief?period=${period}&asOfDate=${asOfDate}`;
}

function moveColor(direction: number | null, inverse = false) {
  if (direction === null || direction === 0) return "text-slate-500";
  const rising = direction > 0;
  return (inverse ? !rising : rising) ? "text-emerald-600" : "text-rose-600";
}

function barWidthPercent(changePct: number | null) {
  if (changePct === null) return 0;
  const capped = Math.min(Math.abs(changePct), 8);
  return Math.max((capped / 8) * 100, changePct === 0 ? 0 : 4);
}

async function loadBrief(period: MarketBriefPeriod, asOfDate: string) {
  try {
    const report = await getStoredOrLiveMarketBrief({ period, asOfDate });
    return { brief: report.brief, snapshot: report.snapshot, error: "" };
  } catch (cause) {
    return { brief: null, snapshot: null, error: cause instanceof Error ? cause.message : "報告暫時無法產生" };
  }
}

export default async function BriefPage({ searchParams }: {
  searchParams: Promise<{ period?: string; asOfDate?: string }>;
}) {
  const params = await searchParams;
  const period = (["daily", "weekly", "monthly"].includes(params.period ?? "") ? params.period : "daily") as MarketBriefPeriod;
  const asOfDate = validDate(params.asOfDate);
  const { brief, snapshot, error } = await loadBrief(period, asOfDate);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
        <header className="border-b border-slate-200 pb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600" />
              <span className="text-xs font-bold tracking-[0.2em] text-slate-500">TRENDRADAR</span>
            </div>
            <form className="flex items-center gap-2" action="/brief">
              <input type="hidden" name="period" value={period} />
              <label className="sr-only" htmlFor="asOfDate">報告日期</label>
              <input
                id="asOfDate"
                name="asOfDate"
                type="date"
                defaultValue={asOfDate}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600"
              />
              <button className="h-8 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-700">
                查詢
              </button>
            </form>
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">台股・美股市場晨報</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5">
              {(["daily", "weekly", "monthly"] as const).map((item) => (
                <Link
                  key={item}
                  href={periodHref(item, asOfDate)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    item === period ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {periodLabels[item]}報告
                </Link>
              ))}
            </div>
            <span className="text-xs text-slate-400">{asOfDate}</span>
          </div>
        </header>

        {error || !brief ? <ErrorState message={error} /> : <Report brief={brief} revision={snapshot?.revision ?? null} />}

        <footer className="mt-12 border-t border-slate-200 pt-6 text-xs leading-6 text-slate-400">
          <p>
            本報告內容僅為市場資料整理與研究觀察，非投資建議、非個股買賣推薦，亦不保證未來報酬。單一來源行情標示為暫定，不進入回測與績效統計。投資前請自行查證並評估風險。詳見
            {" "}<Link href="/legal/disclaimer" className="underline hover:text-slate-600">免責聲明</Link>。
          </p>
        </footer>
      </div>
    </main>
  );
}

function Report({ brief, revision }: { brief: MarketBrief; revision: number | null }) {
  return (
    <div className="mt-8">
      <p className="text-lg leading-8 text-slate-700">{brief.executiveSummary}</p>
      <p className="mt-3 text-xs text-slate-400">
        {brief.reportWindow.startDate} 至 {brief.reportWindow.endDate} · {revision ? `定版快照 r${revision}` : "即時預覽"}
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <OutlookCard title="台股" outlook={brief.outlook.taiwan} />
        <OutlookCard title="美股" outlook={brief.outlook.us} />
      </section>

      <MarketSection section={brief.taiwan} />
      <MarketSection section={brief.us} />

      <MethodologyAppendix brief={brief} />
    </div>
  );
}

function OutlookCard({ title, outlook }: { title: string; outlook: MarketBriefOutlook }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${biasDot[outlook.bias]}`} />
        <p className="text-xs font-semibold text-slate-400">{title}研判</p>
      </div>
      <p className={`mt-1.5 text-xl font-bold ${biasTextColor[outlook.bias]}`}>{biasText(outlook)}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{outlook.summary}</p>
    </div>
  );
}

function MarketSection({ section }: { section: MarketBriefSection }) {
  const label = section.market === "TW" ? "台股" : "美股";
  return (
    <section className="mt-10">
      <SectionLabel>{label}焦點指數</SectionLabel>
      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-5">
        {section.indices.map((index) => (
          <div key={index.symbol}>
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              {index.label}
              {index.dataTier === "provisional" ? <span className="text-amber-500">單一來源</span> : null}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{index.close?.toLocaleString("zh-TW") ?? "—"}</p>
            <p className={`text-sm font-semibold tabular-nums ${moveColor(index.changePct, index.symbol === "^VIX")}`}>
              {signedPercent(index.changePct)}
              <span className="ml-1.5 font-normal text-slate-400">{signedAmount(index.changePoint)} 點</span>
            </p>
            <p className="text-xs text-slate-400">{index.streakLabel}</p>
          </div>
        ))}
      </div>

      {/* US sector/theme movers temporarily hidden -- indices only for now
          while TW data quality work is prioritized, same policy as the
          original /reports/market-brief page. */}
      {section.sectors.length > 0 && section.market !== "US" ? (
        <div className="mt-8">
          <SectionLabel>{label}族群表現</SectionLabel>
          <div className="mt-3 divide-y divide-slate-100">
            {section.sectors.map((sector) => (
              <SectorRow key={sector.label} sector={sector} unitLabel={section.market === "TW" ? "元" : "$"} />
            ))}
          </div>
        </div>
      ) : null}

      {section.institutionalFlows ? <InstitutionFlows flows={section.institutionalFlows} /> : null}
      {section.futuresPositioning ? <FuturesPositioning items={section.futuresPositioning} /> : null}
      {section.marginTrading ? <MarginTrading margin={section.marginTrading} /> : null}
      {section.optionsSentiment ? <OptionsSentiment options={section.optionsSentiment} /> : null}
      {section.fxRate ? <FxRate fx={section.fxRate} /> : null}
    </section>
  );
}

function SectorRow({ sector, unitLabel }: { sector: MarketSectorMove; unitLabel: string }) {
  const positive = (sector.changePct ?? 0) > 0;
  const negative = (sector.changePct ?? 0) < 0;
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{sector.label}</span>
        <span className={`text-sm font-semibold tabular-nums ${moveColor(sector.changePct)}`}>
          {signedPercent(sector.changePct)}
          <span className="ml-1.5 font-normal text-slate-400">{signedAmount(sector.changePoint)}{unitLabel}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full rounded-full bg-slate-100">
        <div
          className={`h-1 rounded-full ${positive ? "bg-emerald-500" : negative ? "bg-rose-500" : "bg-slate-300"}`}
          style={{ width: `${barWidthPercent(sector.changePct)}%` }}
        />
      </div>
      {sector.topStocks.length > 0 ? (
        <p className="mt-1.5 text-xs text-slate-400">
          {sector.topStocks.map((stock) => `${stock.companyName} ${signedPercent(stock.changePct)}`).join(" · ")}
        </p>
      ) : sector.reason ? (
        <p className="mt-1.5 text-xs text-slate-400">{sector.reason}</p>
      ) : null}
    </div>
  );
}

function InstitutionFlows({ flows }: { flows: InstitutionalFlowSummary[] }) {
  return (
    <div className="mt-8">
      <SectionLabel>法人資金流（新台幣）</SectionLabel>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400">
            <th className="pb-2 font-normal">類別</th>
            <th className="pb-2 font-normal">單日</th>
            <th className="pb-2 font-normal">區間累積</th>
            <th className="pb-2 font-normal">連續</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {flows.map((flow) => (
            <tr key={flow.label}>
              <td className="py-2 font-medium">{flow.label}</td>
              <td className={`py-2 tabular-nums ${flow.direction === "buy" ? "text-emerald-600" : flow.direction === "sell" ? "text-rose-600" : "text-slate-500"}`}>
                {compactAmount(flow.singleDayAmount, flow.unit)}
              </td>
              <td className="py-2 tabular-nums text-slate-500">{compactAmount(flow.cumulativeAmount, flow.unit)}</td>
              <td className="py-2 text-slate-500">{flow.consecutiveDays ?? "—"} 日</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FuturesPositioning({ items }: { items: TaiwanFuturesPositioning[] }) {
  return (
    <div className="mt-8">
      <SectionLabel>台指期三大法人未平倉（口數）</SectionLabel>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400">
            <th className="pb-2 font-normal">類別</th>
            <th className="pb-2 font-normal">多單</th>
            <th className="pb-2 font-normal">空單</th>
            <th className="pb-2 font-normal">淨部位</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.investor}>
              <td className="py-2 font-medium">{item.investor}</td>
              <td className="py-2 tabular-nums text-slate-500">{item.longContracts?.toLocaleString("zh-TW") ?? "待補"}</td>
              <td className="py-2 tabular-nums text-slate-500">{item.shortContracts?.toLocaleString("zh-TW") ?? "待補"}</td>
              <td className={`py-2 tabular-nums ${item.direction === "net_long" ? "text-emerald-600" : item.direction === "net_short" ? "text-rose-600" : "text-slate-500"}`}>
                {item.netContracts !== null ? `${item.netContracts >= 0 ? "+" : ""}${item.netContracts.toLocaleString("zh-TW")}` : "待補"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-400">{items[0]?.reason ?? ""}</p>
    </div>
  );
}

function MarginTrading({ margin }: { margin: MarginTradingSummary }) {
  if (margin.status === "pending") return null;
  return (
    <div className="mt-8">
      <SectionLabel>融資融券餘額（上市）</SectionLabel>
      {/* Direction here is descriptive, not evidence: rising margin balance can
          read as either bullish leverage or a contrarian risk warning, so it
          is deliberately shown in neutral slate rather than green/red. */}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-400">融資餘額</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{compactAmount(margin.marginBalanceAmountTwd, "twd")}</p>
          <p className="text-sm tabular-nums text-slate-500">{compactAmount(margin.marginBalanceChangeAmountTwd, "twd")}（單日）</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">融券餘額</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{margin.shortBalanceLots?.toLocaleString("zh-TW") ?? "待補"} 張</p>
          <p className="text-sm tabular-nums text-slate-500">{signedAmount(margin.shortBalanceChangeLots, 0)} 張（單日）</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">{margin.reason}</p>
    </div>
  );
}

function OptionsSentiment({ options }: { options: OptionsSentimentSummary }) {
  if (options.status === "pending") return null;
  return (
    <div className="mt-8">
      <SectionLabel>臺指選擇權 Put/Call 比</SectionLabel>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-400">成交量比</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{options.putCallVolumeRatioPct?.toFixed(2) ?? "待補"}%</p>
          <p className="text-sm text-slate-500">Put {options.putVolume?.toLocaleString("zh-TW") ?? "—"} ／ Call {options.callVolume?.toLocaleString("zh-TW") ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">未平倉比</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{options.putCallOiRatioPct?.toFixed(2) ?? "待補"}%</p>
          <p className="text-sm text-slate-500">Put {options.putOpenInterest?.toLocaleString("zh-TW") ?? "—"} ／ Call {options.callOpenInterest?.toLocaleString("zh-TW") ?? "—"}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">{options.reason}</p>
    </div>
  );
}

function FxRate({ fx }: { fx: FxRateSummary }) {
  if (fx.status === "pending") return null;
  return (
    <div className="mt-8">
      <div className="flex items-center gap-1.5">
        <SectionLabel>{fx.pair} 匯率</SectionLabel>
        {fx.dataTier === "provisional" ? <span className="text-xs text-amber-500">單一來源</span> : null}
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums">{fx.rate?.toFixed(3) ?? "待補"}</p>
      <p className="text-sm tabular-nums text-slate-500">{signedAmount(fx.changeAmount, 4)}（{signedPercent(fx.changePct)}）</p>
      <p className="mt-2 text-xs text-slate-400">{fx.reason}</p>
    </div>
  );
}

function MethodologyAppendix({ brief }: { brief: MarketBrief }) {
  return (
    <details className="mt-12 rounded-xl border border-slate-200 p-5 text-sm text-slate-500">
      <summary className="cursor-pointer font-medium text-slate-600">資料方法與涵蓋範圍</summary>
      <div className="mt-4 space-y-3">
        <p className="leading-6">{brief.dataPolicy.caveat}</p>
        <p className="leading-6">{brief.outlook.caveat}</p>
        <div className="grid gap-2 pt-2 sm:grid-cols-2">
          {brief.dataQuality.map((item) => (
            <div key={item.label} className="text-xs leading-5">
              <strong className="text-slate-600">{item.label}</strong>
              <span className="text-slate-400"> — {statusText(item.status)} · Coverage {item.coverage}</span>
            </div>
          ))}
        </div>
        {brief.dataGaps.length > 0 ? (
          <details className="pt-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">完整資料缺口清單</summary>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-400">
              {brief.dataGaps.map((gap) => <li key={gap}>• {gap}</li>)}
            </ul>
          </details>
        ) : null}
      </div>
    </details>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{children}</p>;
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="mt-10 rounded-xl border border-rose-200 bg-rose-50 p-6">
      <h2 className="font-semibold text-rose-800">報告暫時無法產生</h2>
      <p className="mt-2 text-sm leading-6 text-rose-700">{message}</p>
    </section>
  );
}

