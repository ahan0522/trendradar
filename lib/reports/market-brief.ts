import { getSupabaseAdmin } from "@/lib/supabase-server";
import { marketDataRequirementsForReport } from "@/lib/reports/market-data-requirements";
import { marketBriefIndexPriceTargets } from "@/lib/reports/market-brief-price-targets";
import { fetchTwseInstitutionalTradingRange, type TwseInstitutionalTradingSummary } from "@/lib/research-data/twse";
import { fetchTpexInstitutionalTradingRange } from "@/lib/research-data/tpex";
import {
  LIVE_SIGNAL_LEDGER_START_DATE,
  signalDataModeForDate,
} from "@/lib/signals/live-collection-policy";
import type {
  InstitutionalFlowSummary,
  MarketBrief,
  MarketBriefDataQualityItem,
  MarketBriefPeriod,
  MarketBriefOutlook,
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

type MarketThemeGroup = {
  label: string;
  symbols: Array<{ symbol: string; companyName: string }>;
};

const TW_THEME_GROUPS: MarketThemeGroup[] = [
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

const US_SECTOR_ETF_GROUPS: MarketThemeGroup[] = [
  { label: "科技 ETF", symbols: [{ symbol: "XLK", companyName: "Technology Select Sector SPDR" }] },
  { label: "半導體 ETF", symbols: [{ symbol: "SMH", companyName: "VanEck Semiconductor ETF" }] },
  { label: "通訊服務 ETF", symbols: [{ symbol: "XLC", companyName: "Communication Services Select Sector SPDR" }] },
  { label: "非必需消費 ETF", symbols: [{ symbol: "XLY", companyName: "Consumer Discretionary Select Sector SPDR" }] },
  { label: "金融 ETF", symbols: [{ symbol: "XLF", companyName: "Financial Select Sector SPDR" }] },
  { label: "工業 ETF", symbols: [{ symbol: "XLI", companyName: "Industrial Select Sector SPDR" }] },
  { label: "能源 ETF", symbols: [{ symbol: "XLE", companyName: "Energy Select Sector SPDR" }] },
  { label: "醫療保健 ETF", symbols: [{ symbol: "XLV", companyName: "Health Care Select Sector SPDR" }] },
  { label: "必需消費 ETF", symbols: [{ symbol: "XLP", companyName: "Consumer Staples Select Sector SPDR" }] },
  { label: "公用事業 ETF", symbols: [{ symbol: "XLU", companyName: "Utilities Select Sector SPDR" }] },
  { label: "原物料 ETF", symbols: [{ symbol: "XLB", companyName: "Materials Select Sector SPDR" }] },
  { label: "不動產 ETF", symbols: [{ symbol: "XLRE", companyName: "Real Estate Select Sector SPDR" }] },
];

const TW_THEME_SYMBOLS = [...new Set(TW_THEME_GROUPS.flatMap((group) => group.symbols.map((item) => item.symbol)))];
const US_SECTOR_ETF_SYMBOLS = [...new Set(US_SECTOR_ETF_GROUPS.flatMap((group) => group.symbols.map((item) => item.symbol)))];

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
    reason: "尚未取得報告區間內 TWSE/TPEx 官方三大法人交易資料。",
  };
}

export function mergeInstitutionalTradingSummaries(
  ...groups: TwseInstitutionalTradingSummary[][]
) {
  const merged = new Map<string, TwseInstitutionalTradingSummary>();
  for (const item of groups.flat()) {
    if (item.qualityStatus !== "verified") continue;
    const key = `${item.tradeDate}|${item.label}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...item,
        sourceUrls: [...new Set(item.sourceUrls ?? [item.sourceUrl])],
      });
      continue;
    }
    const sourceUrls = [...new Set([
      ...(existing.sourceUrls ?? [existing.sourceUrl]),
      ...(item.sourceUrls ?? [item.sourceUrl]),
    ])];
    const topBuys = [...existing.topBuys, ...item.topBuys]
      .sort((a, b) => b.netShares - a.netShares)
      .slice(0, 5);
    const topSells = [...existing.topSells, ...item.topSells]
      .sort((a, b) => a.netShares - b.netShares)
      .slice(0, 5);
    merged.set(key, {
      ...existing,
      fetchedAt: existing.fetchedAt > item.fetchedAt ? existing.fetchedAt : item.fetchedAt,
      netShares: existing.netShares + item.netShares,
      buyShares: existing.buyShares + item.buyShares,
      sellShares: existing.sellShares + item.sellShares,
      topBuys,
      topSells,
      sourceUrls,
      market: undefined,
    });
  }
  return [...merged.values()].sort((a, b) =>
    a.tradeDate.localeCompare(b.tradeDate) || a.label.localeCompare(b.label));
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
    sourceUrls: latest.sourceUrls ?? [latest.sourceUrl],
    topStocks: (latest.netShares >= 0 ? latest.topBuys : latest.topSells).slice(0, 5).map((item) => ({
      symbol: item.symbol,
      companyName: item.companyName,
      netAmount: item.netShares,
      unit: "shares",
    })),
    status: "partial",
    reason: (latest.sourceUrls?.length ?? 1) > 1
      ? "已合併 TWSE T86 與 TPEx 官方上櫃三大法人日序列，單位為股；金額制資料仍待補齊。"
      : "目前僅有單一市場的官方三大法人日序列，另一市場與金額制資料仍待補齊。",
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
    .filter((item) =>
      item.symbol === symbol &&
      item.market === market &&
      item.quality_status === "verified")
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
    reason: "已有最近兩筆可信價格，但連續漲跌仍需更長序列。",
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

function buildThemeGroupMoves(
  prices: PriceRow[],
  startDate: string,
  asOfDate: string,
  groups: MarketThemeGroup[],
  market: "TW" | "US",
): ThemeGroupMove[] {
  return groups.flatMap((group) => {
    const stockMoves = group.symbols.flatMap((stock) => {
      const rows = verifiedRowsForSymbol(prices, stock.symbol, market);
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

function themeMoveToSector(
  group: ThemeGroupMove,
  direction: "up" | "down",
  reasons: { stock: string; sector: string },
): MarketSectorMove {
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
      reason: reasons.stock,
    })),
    status: "partial",
    reason: reasons.sector,
  };
}

function buildMarketThemeMovesFromPrices(
  prices: PriceRow[],
  startDate: string,
  asOfDate: string,
  groups: MarketThemeGroup[],
  market: "TW" | "US",
  labels: { up: string; down: string; pendingUp: string; pendingDown: string; stockReason: string; sectorReason: string },
): MarketSectorMove[] {
  const groupMoves = buildThemeGroupMoves(prices, startDate, asOfDate, groups, market);
  const strongest = groupMoves.filter((item) => item.changePct > 0).sort((a, b) => b.changePct - a.changePct)[0];
  const weakest = groupMoves.filter((item) => item.changePct < 0).sort((a, b) => a.changePct - b.changePct)[0];
  return [
    strongest
      ? themeMoveToSector(strongest, "up", { stock: labels.stockReason, sector: labels.sectorReason })
      : pendingSector(labels.up, labels.pendingUp),
    weakest
      ? themeMoveToSector(weakest, "down", { stock: labels.stockReason, sector: labels.sectorReason })
      : pendingSector(labels.down, labels.pendingDown),
  ];
}
export function buildTaiwanThemeMovesFromPrices(
  prices: PriceRow[],
  startDate: string,
  asOfDate: string,
): MarketSectorMove[] {
  return buildMarketThemeMovesFromPrices(prices, startDate, asOfDate, TW_THEME_GROUPS, "TW", {
    up: "上漲族群",
    down: "下跌族群",
    pendingUp: "維護主題籃子尚未有足夠 verified 價格可計算上漲族群。",
    pendingDown: "維護主題籃子尚未有足夠 verified 價格可計算下跌族群。",
    stockReason: "維護主題籃子；僅用 verified 台股價格計算，非官方產業指數。",
    sectorReason: "以 TrendRadar 維護的直接受惠台股主題籃子計算族群強弱；官方產業指數與完整成分股仍需補齊。",
  });
}

export function buildUsSectorEtfMovesFromPrices(
  prices: PriceRow[],
  startDate: string,
  asOfDate: string,
): MarketSectorMove[] {
  return buildMarketThemeMovesFromPrices(prices, startDate, asOfDate, US_SECTOR_ETF_GROUPS, "US", {
    up: "上漲 ETF 產業",
    down: "下跌 ETF 產業",
    pendingUp: "美股 sector ETF 尚未有足夠 verified 價格可計算上漲產業。",
    pendingDown: "美股 sector ETF 尚未有足夠 verified 價格可計算下跌產業。",
    stockReason: "Sector ETF proxy；僅用 verified 美股價格計算，非完整成分股排行。",
    sectorReason: "以 SPDR / semiconductor sector ETF 作為產業方向 proxy；完整成分股排行與雙來源驗證仍需補齊。",
  });
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

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function buildMarketOutlook(section: MarketBriefSection): MarketBriefOutlook {
  const positiveEvidence: string[] = [];
  const negativeEvidence: string[] = [];
  const unresolvedData: string[] = [];

  for (const index of section.indices) {
    if (index.changePct === null || index.status === "pending") {
      unresolvedData.push(`${index.label} 漲跌與連續天數待補`);
    } else if (index.changePct > 0) {
      positiveEvidence.push(`${index.label} ${signedPercent(index.changePct)}`);
    } else if (index.changePct < 0) {
      negativeEvidence.push(`${index.label} ${signedPercent(index.changePct)}`);
    }
  }
  for (const sector of section.sectors) {
    if (sector.changePct === null || sector.status === "pending") {
      unresolvedData.push(`${sector.label} 待補可信價格`);
    } else if (sector.direction === "up") {
      positiveEvidence.push(`${sector.label} ${signedPercent(sector.changePct)}`);
    } else if (sector.direction === "down") {
      negativeEvidence.push(`${sector.label} ${signedPercent(sector.changePct)}`);
    }
  }
  for (const flow of section.institutionalFlows ?? []) {
    if (flow.direction === "pending" || flow.singleDayAmount === null) {
      unresolvedData.push(`${flow.label} 資金流待補`);
    } else if (flow.direction === "buy") {
      positiveEvidence.push(`${flow.label} 單日淨買超`);
    } else if (flow.direction === "sell") {
      negativeEvidence.push(`${flow.label} 單日淨賣超`);
    }
  }

  const evidenceCount = positiveEvidence.length + negativeEvidence.length;
  const balance = positiveEvidence.length - negativeEvidence.length;
  const bias = evidenceCount === 0
    ? "pending"
    : balance >= 2
      ? "constructive"
      : balance <= -2
        ? "cautious"
        : "mixed";
  const confidence = evidenceCount === 0
    ? "pending"
    : evidenceCount >= 4 && unresolvedData.length <= evidenceCount
      ? "medium"
      : "low";
  const biasText = bias === "constructive"
    ? "偏多觀察"
    : bias === "cautious"
      ? "偏空觀察"
      : bias === "mixed"
        ? "多空交錯"
        : "資料不足";
  const nextSessionFocus = [
    ...section.sectors
      .filter((item) => item.status !== "pending")
      .slice(0, 2)
      .map((item) => `${item.label}是否延續`),
    ...(section.market === "TW" ? ["外資與投信是否延續同方向"] : ["四大指數與 sector ETF 是否同向"]),
  ];

  return {
    market: section.market,
    bias,
    confidence,
    summary: evidenceCount === 0
      ? `${section.title}尚無足夠已驗證市場資料，暫不判定方向。`
      : `${section.title}目前為${biasText}；依 ${evidenceCount} 項已驗證觀察整理，非漲跌預測。`,
    positiveEvidence,
    negativeEvidence,
    unresolvedData: [...new Set(unresolvedData)],
    nextSessionFocus: [...new Set(nextSessionFocus)],
  };
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
  usSectors?: MarketSectorMove[];
  signals?: MarketBriefSignal[];
  dataGaps?: string[];
}): MarketBrief {
  const mode = signalDataModeForDate(input.asOfDate);
  const startDate = input.startDate ?? liveClampedReportStartDate(input.period, input.asOfDate);
  const signals = input.signals ?? [];
  const hasCombinedInstitutionMarkets = input.twInstitutionalFlows?.some((item) =>
    (item.sourceUrls?.length ?? 1) > 1) ?? false;
  const dataGaps = [
    ...(input.dataGaps ?? []),
    hasCombinedInstitutionMarkets
      ? "台股官方產業指數、法人金額制資料與完整成分股漲跌仍需接入官方或授權資料源。"
      : "台股官方產業指數、櫃買法人與完整成分股漲跌仍需接入官方或授權資料源。",
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
    sectors: input.usSectors ?? [
      pendingSector("上漲產業", "尚未接入可信 S&P / Nasdaq sector ETF 與成分股日漲跌資料。"),
      pendingSector("下跌產業", "尚未接入可信 S&P / Nasdaq sector ETF 與成分股日漲跌資料。"),
    ],
  };
  const taiwanInstitutionCoverage = taiwan.institutionalFlows?.some((item) => item.status !== "pending") ?? false;
  const taiwanSectorCoverage = taiwan.sectors.some((item) => item.status !== "pending");
  const usSectorCoverage = us.sectors.some((item) => item.status !== "pending");
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
      reason: taiwanInstitutionCoverage && taiwanSectorCoverage
        ? hasCombinedInstitutionMarkets
          ? "TWSE 與 TPEx 三大法人及維護主題籃子 movers 已可用；法人金額制、官方產業指數與完整成分股仍待補齊。"
          : "單一市場法人與維護主題籃子 movers 已部分可用；另一市場、官方產業指數與完整成分股仍待補齊。"
        : taiwanInstitutionCoverage
          ? hasCombinedInstitutionMarkets
            ? "TWSE 與 TPEx 三大法人單日、期間累積與連續買賣已可用；主題籃子與官方產業指數仍待補齊。"
            : "單一市場法人單日、期間累積與連續買賣已可用；另一市場、主題籃子與官方產業指數仍待補齊。"
          : taiwanSectorCoverage
            ? "維護主題籃子 movers 已可用；TWSE/TPEx 法人、官方產業指數與完整成分股仍待補齊。"
            : "三大法人買賣超與產業成分股漲跌尚未接入官方或授權資料源。",
    },
    {
      label: "美股產業與成分股排行",
      status: usSectorCoverage ? "partial" : "pending",
      coverage: `${usSectorCoverage ? 1 : 0}/2`,
      reason: usSectorCoverage
        ? "美股 sector ETF proxy 已部分可用；完整產業成分股排行與雙來源驗證仍待補齊。"
        : "美股 sector 與 constituent performance 尚未接入可信資料源。",
    },
  ] satisfies MarketBriefDataQualityItem[];

  return {
    ok: true,
    reportVersion: "market-brief-v1",
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
    outlook: {
      methodVersion: "market-outlook-v1",
      caveat: "方向標籤只整理已驗證的指數、族群與資金流，不是報酬機率或買賣建議。",
      taiwan: buildMarketOutlook(taiwan),
      us: buildMarketOutlook(us),
    },
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

  const [{ data: signals }, { data: prices }, twseInstitutionalFlows, tpexInstitutionalFlows] = await Promise.all([
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
      .in("symbol", [...TW_INDEX_SYMBOLS, ...US_INDEX_SYMBOLS].map((item) => item.symbol).concat(TW_THEME_SYMBOLS, US_SECTOR_ETF_SYMBOLS))
      .lte("price_date", asOfDate)
      .order("price_date", { ascending: false })
      .limit(500)
      .returns<PriceRow[]>(),
    fetchTwseInstitutionalTradingRange({ startDate, endDate: asOfDate }).catch(() => []),
    fetchTpexInstitutionalTradingRange({ startDate, endDate: asOfDate }).catch(() => []),
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
  const usSectors = buildUsSectorEtfMovesFromPrices(priceRows, startDate, asOfDate);
  const briefSignals = briefSignalRows(signals ?? [], watchlists ?? []);
  const twInstitutionalFlows = mergeInstitutionalTradingSummaries(
    twseInstitutionalFlows,
    tpexInstitutionalFlows,
  );

  return buildMarketBrief({
    period,
    asOfDate,
    startDate,
    taiwanIndices,
    usIndices,
    twInstitutionalFlows,
    taiwanSectors,
    usSectors,
    signals: briefSignals,
  });
}























