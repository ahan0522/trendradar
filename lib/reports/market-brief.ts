import { getSupabaseAdmin } from "@/lib/supabase-server";
import { marketDataRequirementsForReport } from "@/lib/reports/market-data-requirements";
import { marketBriefIndexPriceTargets } from "@/lib/reports/market-brief-price-targets";
import { fetchTwseInstitutionalTradingRange, type TwseInstitutionalTradingSummary } from "@/lib/research-data/twse";
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

const TW_THEME_GROUPS = [
  {
    label: "記憶體族群",
    symbols: [
      { symbol: "2408.TW", companyName: "南亞科" },
      { symbol: "2344.TW", companyName: "華邦電" },
      { symbol: "8299.TW", companyName: "群聯" },
    ],
  },
  {
    label: "AI 電力與重電族群",
    symbols: [
      { symbol: "2308.TW", companyName: "台達電" },
      { symbol: "1513.TW", companyName: "中興電" },
      { symbol: "1519.TW", companyName: "華城" },
    ],
  },
  {
    label: "AI 散熱族群",
    symbols: [
      { symbol: "3017.TW", companyName: "奇鋐" },
      { symbol: "3324.TW", companyName: "雙鴻" },
      { symbol: "2308.TW", companyName: "台達電" },
    ],
  },
  {
    label: "AI 伺服器族群",
    symbols: [
      { symbol: "2317.TW", companyName: "鴻海" },
      { symbol: "6669.TW", companyName: "緯穎" },
      { symbol: "2382.TW", companyName: "廣達" },
    ],
  },
  {
    label: "先進封裝族群",
    symbols: [
      { symbol: "2330.TW", companyName: "台積電" },
      { symbol: "3711.TW", companyName: "日月光投控" },
    ],
  },
  {
    label: "光通訊族群",
    symbols: [
      { symbol: "6451.TW", companyName: "訊芯-KY" },
      { symbol: "3081.TW", companyName: "聯亞" },
      { symbol: "3363.TW", companyName: "上詮" },
      { symbol: "3163.TW", companyName: "波若威" },
    ],
  },
];

const TW_THEME_SYMBOLS = [...new Set(TW_THEME_GROUPS.flatMap((group) => group.symbols.map((item) => item.symbol)))];

type ThemeGroupMove = {
  label: string;
  changePct: number;
  stockMoves: Array<{ symbol: string; companyName: string; changePct: number }>;
};

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

function institutionDirection(netShares: number): InstitutionalFlowSummary["direction"] {
  if (netShares > 0) return "buy";
  if (netShares < 0) return "sell";
  return "flat";
}

function consecutiveInstitutionDays(flows: TwseInstitutionalTradingSummary[]) {
  const sorted = flows.slice().sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));
  const latest = sorted[0];
  if (!latest) return null;
  const direction = institutionDirection(latest.netShares);
  if (direction === "flat") return 1;
  let count = 0;
  for (const flow of sorted) {
    if (institutionDirection(flow.netShares) !== direction) break;
    count += 1;
  }
  return count;
}

function institutionFromTwse(
  label: InstitutionalFlowSummary["label"],
  flows: TwseInstitutionalTradingSummary[] | null | undefined,
): InstitutionalFlowSummary {
  const labelFlows = (flows ?? [])
    .filter((item) => item.label === label)
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const latest = labelFlows.at(-1);
  if (!latest) return pendingInstitution(label);
  const direction = institutionDirection(latest.netShares);
  const cumulativeAmount = labelFlows.reduce((sum, item) => sum + item.netShares, 0);
  return {
    label,
    singleDayAmount: latest.netShares,
    cumulativeAmount,
    consecutiveDays: consecutiveInstitutionDays(labelFlows),
    direction,
    unit: "shares",
    sourceUrl: latest.sourceUrl,
    topStocks: (latest.netShares >= 0 ? latest.topBuys : latest.topSells).slice(0, 5).map((item) => ({
      symbol: item.symbol,
      companyName: item.companyName,
      netAmount: item.netShares,
      unit: "shares",
    })),
    status: "partial",
    reason: "已接入 TWSE T86 上市三大法人日序列，單位為股；櫃買法人與金額制資料仍待補齊。",
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

function priceValue(row: PriceRow) {
  return Number(row.adj_close ?? row.close);
}

function verifiedRowsForSymbol(prices: PriceRow[], symbol: string, market: "TW" | "US") {
  return prices
    .filter((item) => item.symbol === symbol && item.market === market && item.quality_status === "verified")
    .sort((a, b) => b.price_date.localeCompare(a.price_date));
}

function latestVerifiedOnOrBefore(rows: PriceRow[], asOfDate: string) {
  return rows.find((item) => item.price_date <= asOfDate) ?? null;
}

function comparisonVerifiedPrice(rows: PriceRow[], startDate: string, latestDate: string) {
  const beforeStart = rows.find((item) => item.price_date < startDate && item.price_date < latestDate);
  if (beforeStart) return beforeStart;
  return rows.find((item) => item.price_date < latestDate) ?? null;
}

function buildThemeGroupMoves(prices: PriceRow[], startDate: string, asOfDate: string): ThemeGroupMove[] {
  return TW_THEME_GROUPS.flatMap((group) => {
    const stockMoves = group.symbols.flatMap((stock) => {
      const rows = verifiedRowsForSymbol(prices, stock.symbol, "TW");
      const latest = latestVerifiedOnOrBefore(rows, asOfDate);
      if (!latest) return [];
      const base = comparisonVerifiedPrice(rows, startDate, latest.price_date);
      if (!base) return [];
      const latestClose = priceValue(latest);
      const baseClose = priceValue(base);
      if (!Number.isFinite(latestClose) || !Number.isFinite(baseClose) || baseClose <= 0) return [];
      return [{
        symbol: stock.symbol,
        companyName: stock.companyName,
        changePct: Number((((latestClose - baseClose) / baseClose) * 100).toFixed(2)),
      }];
    });

    if (stockMoves.length < Math.min(2, group.symbols.length)) return [];
    const changePct = stockMoves.reduce((sum, item) => sum + item.changePct, 0) / stockMoves.length;
    return [{
      label: group.label,
      changePct: Number(changePct.toFixed(2)),
      stockMoves,
    }];
  });
}

function themeMoveToSector(group: ThemeGroupMove, direction: "up" | "down"): MarketSectorMove {
  const sortedStocks = group.stockMoves
    .slice()
    .sort((a, b) => direction === "up" ? b.changePct - a.changePct : a.changePct - b.changePct)
    .slice(0, 5);
  return {
    label: group.label,
    direction,
    changePct: group.changePct,
    topStocks: sortedStocks.map((item) => ({
      symbol: item.symbol,
      companyName: item.companyName,
      changePct: item.changePct,
      reason: "維護主題籃子；僅用 verified 台股價格計算，非官方產業指數。",
    })),
    status: "partial",
    reason: "以 TrendRadar 維護的直接受惠台股主題籃子計算族群強弱；官方產業指數與完整成分股仍需補齊。",
  };
}

export function buildTaiwanThemeMovesFromPrices(
  prices: PriceRow[],
  startDate: string,
  asOfDate: string,
): MarketSectorMove[] {
  const groupMoves = buildThemeGroupMoves(prices, startDate, asOfDate);
  const strongest = groupMoves.filter((item) => item.changePct > 0).sort((a, b) => b.changePct - a.changePct)[0];
  const weakest = groupMoves.filter((item) => item.changePct < 0).sort((a, b) => a.changePct - b.changePct)[0];
  return [
    strongest
      ? themeMoveToSector(strongest, "up")
      : pendingSector("上漲族群", "維護主題籃子尚未有足夠 verified 價格可計算上漲族群。"),
    weakest
      ? themeMoveToSector(weakest, "down")
      : pendingSector("下跌族群", "維護主題籃子尚未有足夠 verified 價格可計算下跌族群。"),
  ];
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
  twInstitutionalFlows?: TwseInstitutionalTradingSummary[];
  taiwanSectors?: MarketSectorMove[];
  signals?: MarketBriefSignal[];
  dataGaps?: string[];
}): MarketBrief {
  const mode = signalDataModeForDate(input.asOfDate);
  const startDate = input.startDate ?? liveClampedReportStartDate(input.period, input.asOfDate);
  const signals = input.signals ?? [];
  const dataGaps = [
    ...(input.dataGaps ?? []),
    "台股官方產業指數、櫃買法人與完整成分股漲跌仍需接入官方或授權資料源。",
    "美股產業漲跌與成分股排行仍需接入可信 sector/constituent 資料源。",
  ];
  const taiwan: MarketBriefSection = {
    market: "TW",
    title: "台股盤勢",
    status: input.taiwanIndices?.some((item) => item.status !== "pending") ? "partial" : "pending",
    summary: "台股日報骨架已建立；目前優先呈現可信資料，缺口不以推測補齊。",
    indices: input.taiwanIndices ?? TW_INDEX_SYMBOLS.map((item) => pendingIndex(item.label, item.symbol, "TW")),
    sectors: input.taiwanSectors ?? [
      pendingSector("上漲族群", "尚未接入可信主題籃子或官方產業分類與成分股日漲跌資料。"),
      pendingSector("下跌族群", "尚未接入可信主題籃子或官方產業分類與成分股日漲跌資料。"),
    ],
    institutionalFlows: (["外資", "投信", "自營商", "三大法人"] as const).map((label) =>
      institutionFromTwse(label, input.twInstitutionalFlows)),
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
  const taiwanInstitutionCoverage = taiwan.institutionalFlows?.some((item) => item.status !== "pending") ?? false;
  const taiwanSectorCoverage = taiwan.sectors.some((item) => item.status !== "pending");
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
      status: taiwanInstitutionCoverage || taiwanSectorCoverage ? "partial" : "pending",
      coverage: `${(taiwanInstitutionCoverage ? 1 : 0) + (taiwanSectorCoverage ? 1 : 0)}/2`,
      reason: taiwanInstitutionCoverage || taiwanSectorCoverage
        ? "TWSE 上市三大法人與維護主題籃子 movers 已部分可用；櫃買法人、官方產業指數與完整成分股仍待補齊。"
        : "三大法人買賣超與產業成分股漲跌尚未接入官方或授權資料源。",
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

  const [{ data: signals }, { data: prices }, twInstitutionalFlows] = await Promise.all([
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
      .in("symbol", [...TW_INDEX_SYMBOLS, ...US_INDEX_SYMBOLS].map((item) => item.symbol).concat(TW_THEME_SYMBOLS))
      .lte("price_date", asOfDate)
      .order("price_date", { ascending: false })
      .limit(500)
      .returns<PriceRow[]>(),
    fetchTwseInstitutionalTradingRange({ startDate, endDate: asOfDate }).catch(() => []),
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
  const taiwanSectors = buildTaiwanThemeMovesFromPrices(priceRows, startDate, asOfDate);
  const briefSignals = briefSignalRows(signals ?? [], watchlists ?? []);

  return buildMarketBrief({
    period,
    asOfDate,
    startDate,
    taiwanIndices,
    usIndices,
    twInstitutionalFlows,
    taiwanSectors,
    signals: briefSignals,
  });
}















