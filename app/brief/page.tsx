import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { getStoredOrLiveMarketBrief } from "@/lib/reports/market-brief-snapshots";
import {
  biasText,
  compactAmount,
  formatTaipeiTimestamp,
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

// Taiwan market convention: red = up/漲, green = down/跌 (the reverse of the
// US convention) -- applied throughout this page for indices, sectors,
// institutional flow, and futures positioning alike.
const biasDot: Record<MarketBriefOutlook["bias"], string> = {
  constructive: "bg-rose-500",
  cautious: "bg-emerald-500",
  mixed: "bg-amber-500",
  pending: "bg-slate-300",
};

const biasTextColor: Record<MarketBriefOutlook["bias"], string> = {
  constructive: "text-rose-700",
  cautious: "text-emerald-700",
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

function moveColor(direction: number | null) {
  if (direction === null || direction === 0) return "text-slate-500";
  return direction > 0 ? "text-rose-600" : "text-emerald-600";
}

function MoveIcon({ direction }: { direction: number | null }) {
  if (direction === null || direction === 0) return null;
  return direction > 0
    ? <TrendingUp className="h-4 w-4 text-rose-500" />
    : <TrendingDown className="h-4 w-4 text-emerald-500" />;
}

// Diverging bar: half-width from the 0% center line, capped at ±8% move.
function barHalfWidthPercent(changePct: number | null) {
  if (changePct === null || changePct === 0) return 0;
  const capped = Math.min(Math.abs(changePct), 8);
  return Math.max((capped / 8) * 50, 4);
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
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
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
        {brief.reportWindow.startDate} 至 {brief.reportWindow.endDate} · {revision ? `定版快照 r${revision}` : "即時預覽"} · 最後更新 {formatTaipeiTimestamp(brief.generatedAt)}
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
  const hasChipData = Boolean(
    section.institutionalFlows || section.futuresPositioning || section.marginTrading || section.optionsSentiment,
  );
  return (
    <section className="mt-12">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">{section.market}</span>
        <h2 className="text-xl font-bold tracking-tight">{label}盤勢</h2>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">焦點指數</p>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {section.indices.map((index) => (
            <div key={index.symbol}>
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                {index.label}
                {index.dataTier === "provisional" ? <span className="text-amber-500">單一來源</span> : null}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{index.close?.toLocaleString("zh-TW") ?? "—"}</p>
              <p className={`flex items-center gap-1 text-sm font-semibold tabular-nums ${moveColor(index.changePct)}`}>
                {index.changePct === null ? "待補" : (
                  <>
                    <MoveIcon direction={index.changePct} />
                    {signedPercent(index.changePct)}
                    <span className="font-normal text-slate-400">{signedAmount(index.changePoint)} 點</span>
                  </>
                )}
              </p>
              <p className="text-xs text-slate-400">{index.streakLabel}</p>
            </div>
          ))}
        </div>
      </div>

      {hasChipData ? (
        <div className="mt-4 rounded-2xl border border-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">資金與籌碼</p>
          {section.institutionalFlows || section.futuresPositioning ? (
            <InvestorGrid flows={section.institutionalFlows} futures={section.futuresPositioning} />
          ) : null}
          {section.marginTrading || section.optionsSentiment || section.fxRate ? (
            <QuickStats margin={section.marginTrading} options={section.optionsSentiment} fx={section.fxRate} />
          ) : null}
        </div>
      ) : null}

      {/* US sector/theme movers temporarily hidden -- indices only for now
          while TW data quality work is prioritized, same policy as the
          original /reports/market-brief page. */}
      {section.sectors.length > 0 && section.market !== "US" ? (
        <div className="mt-4 rounded-2xl border border-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}族群表現</p>
          <div className="mt-2 divide-y divide-slate-100">
            {section.sectors.map((sector) => (
              <SectorRow key={sector.label} sector={sector} unitLabel={section.market === "TW" ? "元" : "$"} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SectorRow({ sector, unitLabel }: { sector: MarketSectorMove; unitLabel: string }) {
  const positive = (sector.changePct ?? 0) > 0;
  const negative = (sector.changePct ?? 0) < 0;
  return (
    <div className="py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{sector.label}</span>
        <span className={`flex items-center gap-1 text-sm font-semibold tabular-nums ${moveColor(sector.changePct)}`}>
          <MoveIcon direction={sector.changePct} />
          {signedPercent(sector.changePct)}
          <span className="font-normal text-slate-400">{signedAmount(sector.changePoint)}{unitLabel}</span>
        </span>
      </div>
      <div className="relative mt-2 h-1.5 w-full rounded-full bg-slate-100">
        <div className="absolute left-1/2 top-0 h-1.5 w-px bg-slate-300" />
        <div
          className={`absolute top-0 h-1.5 rounded-full ${positive ? "bg-rose-500" : negative ? "bg-emerald-500" : "bg-slate-300"}`}
          style={
            positive
              ? { left: "50%", width: `${barHalfWidthPercent(sector.changePct)}%` }
              : { right: "50%", width: `${barHalfWidthPercent(sector.changePct)}%` }
          }
        />
      </div>
      {sector.topStocks.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-slate-400">
          {sector.topStocks
            .map((stock) => `${stock.companyName} ${signedPercent(stock.changePct)}（${signedAmount(stock.changePoint)}${unitLabel}）`)
            .join(" · ")}
        </p>
      ) : sector.reason ? (
        <p className="mt-2 text-xs text-slate-400">{sector.reason}</p>
      ) : null}
    </div>
  );
}

// Institutional cash flow and futures positioning are both broken down by
// the same four investor categories, so they're combined into one card grid
// instead of two separate tables -- avoids repeating "外資/投信/自營商/三大
// 法人" headers twice and reads better on narrow screens than a table would.
function InvestorGrid({
  flows,
  futures,
}: {
  flows?: InstitutionalFlowSummary[];
  futures?: TaiwanFuturesPositioning[];
}) {
  const labels = ["外資", "投信", "自營商", "三大法人"] as const;
  const flowByLabel = new Map((flows ?? []).map((item) => [item.label, item]));
  const futuresByLabel = new Map((futures ?? []).map((item) => [item.investor, item]));

  return (
    <div className="mt-3">
      <p className="text-xs text-slate-400">現貨買賣超（新台幣）／台指期未平倉（口數）</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {labels.map((label) => {
          const flow = flowByLabel.get(label);
          const future = futuresByLabel.get(label);
          if (!flow && !future) return null;
          return (
            <div key={label} className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">{label}</p>
              {flow ? (
                <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                  <span className="text-xs text-slate-400">現貨</span>
                  <span className={`font-semibold tabular-nums ${flow.direction === "buy" ? "text-rose-600" : flow.direction === "sell" ? "text-emerald-600" : "text-slate-500"}`}>
                    {compactAmount(flow.singleDayAmount, flow.unit)}
                    <span className="ml-1 font-normal text-slate-400">連{flow.consecutiveDays ?? "—"}日</span>
                  </span>
                </div>
              ) : null}
              {future ? (
                <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                  <span className="text-xs text-slate-400">期貨未平倉</span>
                  <span className={`font-semibold tabular-nums ${future.direction === "net_long" ? "text-rose-600" : future.direction === "net_short" ? "text-emerald-600" : "text-slate-500"}`}>
                    {future.netContracts !== null ? `${future.netContracts >= 0 ? "+" : ""}${future.netContracts.toLocaleString("zh-TW")} 口` : "待補"}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickStats({
  margin,
  options,
  fx,
}: {
  margin?: MarginTradingSummary;
  options?: OptionsSentimentSummary;
  fx?: FxRateSummary;
}) {
  const tiles: Array<{ key: string; label: string; value: React.ReactNode; note: React.ReactNode }> = [];

  if (margin && margin.status !== "pending") {
    tiles.push({
      key: "margin",
      label: "融資餘額",
      value: compactAmount(margin.marginBalanceAmountTwd, "twd"),
      note: `${compactAmount(margin.marginBalanceChangeAmountTwd, "twd")}（單日）`,
    });
  }
  if (options && options.status !== "pending") {
    tiles.push({
      key: "pcr",
      label: "Put/Call 量比",
      value: `${options.putCallVolumeRatioPct?.toFixed(2) ?? "待補"}%`,
      note: options.putCallVolumeRatioChangePct !== null
        ? `${options.comparisonLabel} ${signedAmount(options.putCallVolumeRatioChangePct)}`
        : null,
    });
  }
  if (fx && fx.status !== "pending") {
    tiles.push({
      key: "fx",
      label: `${fx.pair}${fx.dataTier === "provisional" ? "（單一來源）" : ""}`,
      value: fx.rate?.toFixed(3) ?? "待補",
      note: `${signedAmount(fx.changeAmount, 4)}（${signedPercent(fx.changePct)}）`,
    });
  }

  if (tiles.length === 0) return null;

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.key} className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-400">{tile.label}</p>
          <p className="mt-1 text-base font-bold tabular-nums">{tile.value}</p>
          {tile.note ? <p className="mt-0.5 text-xs tabular-nums text-slate-500">{tile.note}</p> : null}
        </div>
      ))}
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

function ErrorState({ message }: { message: string }) {
  return (
    <section className="mt-10 rounded-xl border border-rose-200 bg-rose-50 p-6">
      <h2 className="font-semibold text-rose-800">報告暫時無法產生</h2>
      <p className="mt-2 text-sm leading-6 text-rose-700">{message}</p>
    </section>
  );
}
