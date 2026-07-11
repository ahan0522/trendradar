import { getSupabaseAdmin } from "@/lib/supabase-server";
import { marketDataRequirementsForReport } from "@/lib/reports/market-data-requirements";
import { marketBriefIndexPriceTargets } from "@/lib/reports/market-brief-price-targets";
import {
  LIVE_SIGNAL_LEDGER_START_DATE,
  signalDataModeForDate,
} from "@/lib/signals/live-collection-policy";
import type {
  InstitutionalFlowSummary,
  MarketBrief,
  MarketBriefDataQualityItem,
  MarketBriefPeriod,
  MarketBriefSection,
  MarketBriefSignal,
  MarketIndexMove,
  MarketSectorMove,
  TomorrowWatchItem,
} from "@/types/market-report";

type SignalRow = {
  id: string;
  as_of_date: string;
  topic: string;
  signal_strength: number;
  confidence_score: number;
  model_version: string | null;
};

type WatchlistRow = {
  signal_event_id: string;
  symbol: string;
  company_name: string;
  market: string;
  thesis: string;
};

type PriceRow = {
  symbol: string;
  market: string;
  price_date: string;
  close: number;
  adj_close: number | null;
  quality_status: string | null;
};

const TW_INDEX_SYMBOLS = [
  { label: "加權指數", symbol: "^TWII" },
  { label: "櫃買指數", symbol: "^TWOII" },
];

const US_INDEX_SYMBOLS = [
  { label: "道瓊", symbol: "^DJI" },
  { label: "那斯達克", symbol: "^IXIC" },
  { label: "S&P 500", symbol: "^GSPC" },
  { label: "費城半導體", symbol: "^SOX" },
];

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addUtcDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function reportStartDateForPeriod(period: MarketBriefPeriod, asOfDate: string) {
  if (period === "daily") return asOfDate;
  if (period === "monthly") return `${asOfDate.slice(0, 7)}-01`;

  const value = new Date(`${asOfDate}T00:00:00.000Z`);
  const day = value.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return addUtcDays(asOfDate, -daysSinceMonday);
}

function liveClampedReportStartDate(period: MarketBriefPeriod, asOfDate: string) {
  const startDate = reportStartDateForPeriod(period, asOfDate);
  if (signalDataModeForDate(asOfDate) === "live-ledger" && startDate < LIVE_SIGNAL_LEDGER_START_DATE) {
    return LIVE_SIGNAL_LEDGER_START_DATE;
  }
  return startDate;
}

function pendingIndex(label: string, symbol: string, market: "TW" | "US"): MarketIndexMove {
  return {
    label,
    symbol,
    market,
    close: null,
    changePct: null,
    streakLabel: "待補資料",
    status: "pending",
    reason: "尚未建立可信指數日資料與連漲連跌序列。",
  };
}

function pendingSector(label: string, reason: string): MarketSectorMove {
  return {
    label,
    direction: "pending",
    changePct: null,
    topStocks: [],
    status: "pending",
    reason,
  };
}

function pendingInstitution(label: InstitutionalFlowSummary["label"]): InstitutionalFlowSummary {
  return {
    label,
    singleDayAmount: null,
    cumulativeAmount: null,
    consecutiveDays: null,
    direction: "pending",
    status: "pending",
    reason: "尚未接入 TWSE/TPEx 三大法人與投信外資連續買賣超資料表。",
  };
}

function indexCoverageQuality(
  label: string,
  indices: MarketIndexMove[],
): MarketBriefDataQualityItem {
  const readyCount = indices.filter((item) => item.status === "ready").length;
  const partialCount = indices.filter((item) => item.status === "partial").length;
  const usableCount = readyCount + partialCount;
  if (usableCount === 0) {
    return {
      label,
      status: "pending",
      coverage: `0/${indices.length}`,
      reason: "指數價格尚未有足夠的可信日資料，相關漲跌與連續天數暫不輸出。",
    };
  }
  return {
    label,
    status: readyCount === indices.length ? "ready" : "partial",
    coverage: `${usableCount}/${indices.length}`,
    reason: readyCount === indices.length
      ? "指數價格已具備可信日資料。"
      : "部分指數已有可用價格，但仍需補齊 verified 品質與更長序列。",
  };
}

export function buildIndexMoveFromPrices(
  label: string,
  symbol: string,
  market: "TW" | "US",
  prices: PriceRow[],
): MarketIndexMove {
  const rows = prices
    .filter((item) => item.symbol === symbol && item.market === market)
    .sort((a, b) => b.price_date.localeCompare(a.price_date));
  const latest = rows[0];
  const previous = rows[1];
  if (!latest || !previous) return pendingIndex(label, symbol, market);
  const latestClose = Number(latest.adj_close ?? latest.close);
  const previousClose = Number(previous.adj_close ?? previous.close);
  if (!Number.isFinite(latestClose) || !Number.isFinite(previousClose) || previousClose <= 0) {
    return pendingIndex(label, symbol, market);
  }
  const changePct = ((latestClose - previousClose) / previousClose) * 100;
  const direction = changePct > 0 ? "上漲" : changePct < 0 ? "下跌" : "持平";
  return {
    label,
    symbol,
    market,
    close: latestClose,
    changePct: Number(changePct.toFixed(2)),
    streakLabel: `${direction} 1 日；連續天數待完整價格序列確認`,
    status: "partial",
    reason: latest.quality_status === "verified"
      ? "已有最近兩筆可信價格，但連續漲跌仍需更長序列。"
      : "價格未達 verified，僅供內部觀察。",
  };
}

function briefSignalRows(signals: SignalRow[], watchlists: WatchlistRow[]): MarketBriefSignal[] {
  const watchlistsBySignal = new Map<string, WatchlistRow[]>();
  for (const item of watchlists) {
    watchlistsBySignal.set(item.signal_event_id, [
      ...(watchlistsBySignal.get(item.signal_event_id) ?? []),
      item,
    ]);
  }

  return signals
    .slice()
    .sort((a, b) =>
      Number(b.signal_strength) - Number(a.signal_strength) ||
      Number(b.confidence_score) - Number(a.confidence_score))
    .slice(0, 3)
    .map((signal) => ({
      id: signal.id,
      topic: signal.topic,
      signalStrength: Number(signal.signal_strength),
      confidenceScore: Number(signal.confidence_score),
      status: Number(signal.confidence_score) >= 50 ? "ready" : "partial",
      watchlist: (watchlistsBySignal.get(signal.id) ?? []).slice(0, 5).map((item) => ({
        symbol: item.symbol,
        companyName: item.company_name,
        market: item.market,
        reason: item.thesis,
      })),
    }));
}

export function buildMarketBrief(input: {
  period: MarketBriefPeriod;
  asOfDate: string;
  startDate?: string;
  generatedAt?: string;
  taiwanIndices?: MarketIndexMove[];
  usIndices?: MarketIndexMove[];
  signals?: MarketBriefSignal[];
  dataGaps?: string[];
}): MarketBrief {
  const mode = signalDataModeForDate(input.asOfDate);
  const startDate = input.startDate ?? liveClampedReportStartDate(input.period, input.asOfDate);
  const signals = input.signals ?? [];
  const dataGaps = [
    ...(input.dataGaps ?? []),
    "台股法人買賣超、產業漲跌與前 3-5 個股仍需接入官方或授權資料源。",
    "美股產業漲跌與成分股排行仍需接入可信 sector/constituent 資料源。",
  ];
  const taiwan: MarketBriefSection = {
    market: "TW",
    title: "台股盤勢",
    status: input.taiwanIndices?.some((item) => item.status !== "pending") ? "partial" : "pending",
    summary: "台股日報骨架已建立；目前優先呈現可信資料，缺口不以推測補齊。",
    indices: input.taiwanIndices ?? TW_INDEX_SYMBOLS.map((item) => pendingIndex(item.label, item.symbol, "TW")),
    sectors: [
      pendingSector("上漲產業", "尚未接入可信產業分類與成分股日漲跌資料。"),
      pendingSector("下跌產業", "尚未接入可信產業分類與成分股日漲跌資料。"),
    ],
    institutionalFlows: [
      pendingInstitution("外資"),
      pendingInstitution("投信"),
      pendingInstitution("自營商"),
      pendingInstitution("三大法人"),
    ],
  };
  const us: MarketBriefSection = {
    market: "US",
    title: "美股盤勢",
    status: input.usIndices?.some((item) => item.status !== "pending") ? "partial" : "pending",
    summary: "美股日報骨架已建立；指數與產業資料需通過可信價格與成分股來源後才輸出數字。",
    indices: input.usIndices ?? US_INDEX_SYMBOLS.map((item) => pendingIndex(item.label, item.symbol, "US")),
    sectors: [
      pendingSector("上漲產業", "尚未接入可信 S&P / Nasdaq sector 與成分股日漲跌資料。"),
      pendingSector("下跌產業", "尚未接入可信 S&P / Nasdaq sector 與成分股日漲跌資料。"),
    ],
  };
  const tomorrowWatch: TomorrowWatchItem[] = signals.length > 0
    ? signals.slice(0, 3).map((signal) => ({
        title: signal.topic,
        reason: `熱度 ${signal.signalStrength.toFixed(1)}，研究信心 ${signal.confidenceScore.toFixed(1)}；等待後續證據與價格驗證。`,
        dataNeeded: ["新增新聞與官方公告", "產業硬資料", "可信價格與法人/資金流"],
        status: signal.status,
      }))
    : [{
        title: "等待七月 live 資料形成集中訊號",
        reason: "目前已開始收集七月資料，但尚未形成可發布的高品質 Signal。",
        dataNeeded: ["跨來源事件集中度", "產業硬資料", "可驗證受惠標的"],
        status: "pending",
      }];
  const dataQuality = [
    indexCoverageQuality("台股指數價格", taiwan.indices),
    indexCoverageQuality("美股指數價格", us.indices),
    {
      label: "台股法人與產業排行",
      status: "pending",
      coverage: "0/2",
      reason: "三大法人買賣超與產業成分股漲跌尚未接入官方或授權資料源。",
    },
    {
      label: "美股產業與成分股排行",
      status: "pending",
      coverage: "0/2",
      reason: "美股 sector 與 constituent performance 尚未接入可信資料源。",
    },
  ] satisfies MarketBriefDataQualityItem[];

  return {
    ok: true,
    period: input.period,
    asOfDate: input.asOfDate,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    reportWindow: {
      startDate,
      endDate: input.asOfDate,
    },
    dataPolicy: {
      liveStartDate: LIVE_SIGNAL_LEDGER_START_DATE,
      mode,
      caveat: mode === "live-ledger"
        ? "此報告使用 live-first 資料期；缺資料項目以 pending 表示。"
        : "此日期屬 historical-audit，不應包裝為正式 live 發現。",
    },
    title: `${input.asOfDate} ${input.period === "daily" ? "每日" : input.period === "weekly" ? "每週" : "每月"}市場觀察`,
    executiveSummary: signals.length > 0
      ? `目前有 ${signals.length} 個內部訊號可作為明日觀察起點；尚未通過的市場資料缺口不硬補。`
      : "目前資料仍在累積中，尚未形成足夠強的正式市場訊號。",
    taiwan,
    us,
    signals,
    tomorrowWatch,
    weeklyOrMonthlyNotes: input.period === "daily"
      ? ["週報將彙整本週訊號變化、價格驗證進度與資料缺口。"]
      : ["需比較本期與前期 Signal 的延續、降溫、重新升溫與回測成熟度。"],
    dataQuality,
    dataRequirements: marketDataRequirementsForReport(),
    priceTargets: marketBriefIndexPriceTargets(),
    dataGaps: [...new Set(dataGaps)],
  };
}

export async function getMarketBrief(options?: {
  period?: MarketBriefPeriod;
  asOfDate?: string;
}) {
  const period = options?.period ?? "daily";
  const asOfDate = options?.asOfDate ?? currentTaipeiDate();
  const supabase = getSupabaseAdmin();
  const startDate = liveClampedReportStartDate(period, asOfDate);

  const [{ data: signals }, { data: prices }] = await Promise.all([
    supabase
      .from("signal_events")
      .select("id, as_of_date, topic, signal_strength, confidence_score, model_version")
      .gte("as_of_date", startDate)
      .lte("as_of_date", asOfDate)
      .in("model_version", ["monthly-full-market-v3", "rule-v2"])
      .order("signal_strength", { ascending: false })
      .limit(8)
      .returns<SignalRow[]>(),
    supabase
      .from("stock_prices")
      .select("symbol, market, price_date, close, adj_close, quality_status")
      .in("symbol", [...TW_INDEX_SYMBOLS, ...US_INDEX_SYMBOLS].map((item) => item.symbol))
      .lte("price_date", asOfDate)
      .order("price_date", { ascending: false })
      .limit(80)
      .returns<PriceRow[]>(),
  ]);
  const signalIds = (signals ?? []).map((item) => item.id);
  const { data: watchlists } = signalIds.length > 0
    ? await supabase
        .from("signal_watchlists")
        .select("signal_event_id, symbol, company_name, market, thesis")
        .in("signal_event_id", signalIds)
        .order("weight", { ascending: false })
        .returns<WatchlistRow[]>()
    : { data: [] as WatchlistRow[] };

  const priceRows = prices ?? [];
  const taiwanIndices = TW_INDEX_SYMBOLS.map((item) => buildIndexMoveFromPrices(item.label, item.symbol, "TW", priceRows));
  const usIndices = US_INDEX_SYMBOLS.map((item) => buildIndexMoveFromPrices(item.label, item.symbol, "US", priceRows));
  const briefSignals = briefSignalRows(signals ?? [], watchlists ?? []);

  return buildMarketBrief({
    period,
    asOfDate,
    startDate,
    taiwanIndices,
    usIndices,
    signals: briefSignals,
  });
}
