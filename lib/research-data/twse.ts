import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  upsertCompanyActions,
  upsertResearchSources,
} from "@/lib/research-data/repository";
import type { CompanyAction, ResearchSource } from "@/types/research-data";

const TWSE_ACTIONS_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap04_L";
const TWSE_PRICES_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TWSE_TAIEX_HIST_URL = "https://www.twse.com.tw/rwd/zh/TAIEX/MI_5MINS_HIST";
const TWSE_FOREIGN_TRADING_URL = "https://www.twse.com.tw/rwd/zh/fund/TWT38U";
const TWSE_INSTITUTIONAL_TRADING_URL = "https://www.twse.com.tw/rwd/zh/fund/T86";

type TwseActionRow = {
  出表日期?: string;
  發言日期?: string;
  發言時間?: string;
  公司代號?: string;
  公司名稱?: string;
  "主旨 "?: string;
  主旨?: string;
  事實發生日?: string;
  說明?: string;
};

type TwsePriceRow = {
  Date?: string;
  Code?: string;
  Name?: string;
  TradeVolume?: string;
  OpeningPrice?: string;
  HighestPrice?: string;
  LowestPrice?: string;
  ClosingPrice?: string;
};

type TwseTaiexHistoryResponse = {
  stat?: string;
  date?: string;
  title?: string;
  fields?: string[];
  data?: string[][];
  total?: number;
};

type TwseForeignTradingResponse = {
  stat?: string;
  date?: string;
  title?: string;
  fields?: string[];
  data?: string[][];
  notes?: string[];
  groups?: Array<{ start: number; span: number; title: string }>;
  hints?: string;
  total?: number;
};

export type TwseInstitutionalInvestorLabel = "外資" | "投信" | "自營商" | "三大法人";

export type TwseInstitutionalTradingSummary = {
  label: TwseInstitutionalInvestorLabel;
  tradeDate: string;
  sourceUrl: string;
  sourceUrls?: string[];
  fetchedAt: string;
  netShares: number;
  buyShares: number;
  sellShares: number;
  topBuys: Array<{
    symbol: string;
    companyName: string;
    netShares: number;
  }>;
  topSells: Array<{
    symbol: string;
    companyName: string;
    netShares: number;
  }>;
  qualityStatus: "verified" | "no_data";
  market?: "TWSE" | "TPEX";
  reason?: string;
};

export type TwseForeignInvestorTradingSummary = Omit<TwseInstitutionalTradingSummary, "label">;

const twseSource: ResearchSource = {
  id: "twse-openapi",
  name: "臺灣證券交易所 OpenAPI",
  sourceType: "official",
  baseUrl: "https://openapi.twse.com.tw/",
  authorityLevel: "primary",
  reliabilityScore: 95,
};

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function parseRocDate(value: string | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 7) throw new Error(`Invalid TWSE ROC date: ${value ?? "missing"}`);
  const year = Number(digits.slice(0, 3)) + 1911;
  const month = digits.slice(3, 5);
  const day = digits.slice(5, 7);
  return `${year}-${month}-${day}`;
}

export function parseTwsePublishedAt(dateValue: string | undefined, timeValue?: string) {
  const date = parseRocDate(dateValue);
  const rawDigits = (timeValue ?? "0").replace(/\D/g, "");
  if (!rawDigits || rawDigits.length > 6) {
    throw new Error(`Invalid TWSE time: ${timeValue ?? "missing"}`);
  }
  const digits = rawDigits.padStart(6, "0");
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2, 4));
  const second = Number(digits.slice(4, 6));
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error(`Invalid TWSE time: ${timeValue ?? "missing"}`);
  }
  return `${date}T${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}+08:00`;
}

function parsePositiveNumber(value: string | undefined) {
  const parsed = Number((value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseSignedNumber(value: string | undefined) {
  const parsed = Number((value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTwseCalendarDate(value: string | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 8) throw new Error(`Invalid TWSE calendar date: ${value ?? "missing"}`);
  const year = Number(digits.slice(0, 4));
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  if (!Number.isFinite(year) || year < 1900) throw new Error(`Invalid TWSE calendar date: ${value ?? "missing"}`);
  return `${year}-${month}-${day}`;
}

function twseTaiexHistoryUrl(date: string) {
  return `${TWSE_TAIEX_HIST_URL}?date=${date.replaceAll("-", "")}&response=json`;
}

function twseForeignTradingUrl(date: string) {
  return `${TWSE_FOREIGN_TRADING_URL}?date=${date.replaceAll("-", "")}&response=json`;
}

function twseInstitutionalTradingUrl(date: string) {
  return `${TWSE_INSTITUTIONAL_TRADING_URL}?date=${date.replaceAll("-", "")}&selectType=ALL&response=json`;
}

function classifyAction(title: string, summary: string): CompanyAction["actionType"] {
  const text = `${title} ${summary}`.toLowerCase();
  if (/財測|展望|guidance/.test(text)) return "guidance";
  if (/資本支出|capex|投資計畫/.test(text)) return "capex";
  if (/擴產|產能|新廠|量產|停產|減產/.test(text)) return "capacity";
  if (/價格調整|漲價|降價|報價/.test(text)) return "pricing";
  if (/合約|訂單|採購|得標/.test(text)) return "contract";
  if (/新產品|產品發表|認證/.test(text)) return "product";
  if (/併購|收購|合併|處分.*股權/.test(text)) return "m_and_a";
  return "filing";
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "TrendRadar/1.0 research-data@trendradar",
    },
  });
  if (!response.ok) throw new Error(`TWSE request failed: ${response.status} ${url}`);
  return (await response.json()) as T;
}

export async function fetchTwseCompanyActions() {
  const rows = await fetchJson<TwseActionRow[]>(TWSE_ACTIONS_URL);
  const observedAt = new Date().toISOString();

  return rows.flatMap((row): CompanyAction[] => {
    const symbol = row.公司代號?.trim();
    const companyName = row.公司名稱?.trim();
    const title = (row["主旨 "] ?? row.主旨 ?? "").trim();
    if (!symbol || !companyName || !title || !row.發言日期) return [];

    const publishedAt = parseTwsePublishedAt(row.發言日期, row.發言時間);
    const summary = row.說明?.trim();
    return [{
      id: `twse-action-${stableId(`${symbol}|${publishedAt}|${title}`)}`,
      companySymbol: `${symbol}.TW`,
      market: "TW",
      companyName,
      actionType: classifyAction(title, summary ?? ""),
      title,
      summary,
      effectiveDate: row.事實發生日 ? parseRocDate(row.事實發生日) : undefined,
      publishedAt,
      observedAt,
      knownAt: publishedAt,
      sourceId: twseSource.id,
      sourceUrl: TWSE_ACTIONS_URL,
      qualityStatus: "verified",
      metadata: {
        reportDate: row.出表日期 ? parseRocDate(row.出表日期) : undefined,
        officialDataset: "t187ap04_L",
      },
    }];
  });
}

export async function fetchTwseDailyPrices() {
  const rows = await fetchJson<TwsePriceRow[]>(TWSE_PRICES_URL);
  const fetchedAt = new Date().toISOString();

  return rows.flatMap((row) => {
    const code = row.Code?.trim();
    const close = parsePositiveNumber(row.ClosingPrice);
    if (!code || !/^\d{4}$/.test(code) || !close || !row.Date) return [];

    return [{
      symbol: `${code}.TW`,
      market: "TW",
      price_date: parseRocDate(row.Date),
      open: parsePositiveNumber(row.OpeningPrice),
      high: parsePositiveNumber(row.HighestPrice),
      low: parsePositiveNumber(row.LowestPrice),
      close,
      adj_close: close,
      volume: parsePositiveNumber(row.TradeVolume),
      provider: twseSource.id,
      source_url: TWSE_PRICES_URL,
      fetched_at: fetchedAt,
      quality_status: "verified",
      verified_at: fetchedAt,
      verification_provider: twseSource.id,
      updated_at: fetchedAt,
    }];
  });
}

export function parseTwseTaiexIndexPrices(
  payload: TwseTaiexHistoryResponse,
  sourceUrl: string,
  fetchedAt: string,
) {
  if (payload.stat !== "OK" || !Array.isArray(payload.data)) return [];

  return payload.data.flatMap((row) => {
    const priceDate = parseRocDate(row[0]);
    const open = parsePositiveNumber(row[1]);
    const high = parsePositiveNumber(row[2]);
    const low = parsePositiveNumber(row[3]);
    const close = parsePositiveNumber(row[4]);
    if (!priceDate || !close) return [];

    return [{
      symbol: "^TWII",
      market: "TW",
      price_date: priceDate,
      open,
      high,
      low,
      close,
      adj_close: close,
      volume: null,
      provider: twseSource.id,
      source_url: sourceUrl,
      fetched_at: fetchedAt,
      quality_status: "verified",
      verified_at: fetchedAt,
      verification_provider: twseSource.id,
      updated_at: fetchedAt,
    }];
  });
}

export async function fetchTwseTaiexIndexPrices(options?: {
  date?: string;
}) {
  const fetchedAt = new Date().toISOString();
  const date = options?.date ?? fetchedAt.slice(0, 10);
  const url = twseTaiexHistoryUrl(date);
  const payload = await fetchJson<TwseTaiexHistoryResponse>(url);
  return parseTwseTaiexIndexPrices(payload, url, fetchedAt);
}

export function parseTwseForeignInvestorTrading(
  payload: TwseForeignTradingResponse,
  sourceUrl: string,
  fetchedAt: string,
): TwseForeignInvestorTradingSummary | null {
  if (payload.stat !== "OK" || !Array.isArray(payload.data) || payload.data.length === 0) {
    return null;
  }

  const tradeDate = parseTwseCalendarDate(payload.date);
  const rows = payload.data.flatMap((row) => {
    const symbol = row[1]?.trim();
    const companyName = row[2]?.trim();
    const buyShares = parseSignedNumber(row[9]);
    const sellShares = parseSignedNumber(row[10]);
    const netShares = parseSignedNumber(row[11]);
    if (!symbol || !companyName || buyShares === null || sellShares === null || netShares === null) return [];
    return [{ symbol: `${symbol}.TW`, companyName, buyShares, sellShares, netShares }];
  });

  if (rows.length === 0) return null;
  const buyShares = rows.reduce((sum, row) => sum + row.buyShares, 0);
  const sellShares = rows.reduce((sum, row) => sum + row.sellShares, 0);
  const netShares = rows.reduce((sum, row) => sum + row.netShares, 0);
  const byNet = rows.slice().sort((a, b) => b.netShares - a.netShares);

  return {
    tradeDate,
    sourceUrl,
    sourceUrls: [sourceUrl],
    fetchedAt,
    netShares,
    buyShares,
    sellShares,
    topBuys: byNet.filter((row) => row.netShares > 0).slice(0, 5).map(({ symbol, companyName, netShares }) => ({
      symbol,
      companyName,
      netShares,
    })),
    topSells: byNet.filter((row) => row.netShares < 0).slice(-5).reverse().map(({ symbol, companyName, netShares }) => ({
      symbol,
      companyName,
      netShares,
    })),
    qualityStatus: "verified",
    market: "TWSE",
  };
}

export async function fetchTwseForeignInvestorTrading(options?: {
  date?: string;
}) {
  const fetchedAt = new Date().toISOString();
  const date = options?.date ?? fetchedAt.slice(0, 10);
  const url = twseForeignTradingUrl(date);
  const payload = await fetchJson<TwseForeignTradingResponse>(url);
  return parseTwseForeignInvestorTrading(payload, url, fetchedAt);
}

type ParsedInstitutionalRow = {
  symbol: string;
  companyName: string;
  foreignBuy: number;
  foreignSell: number;
  foreignNet: number;
  trustBuy: number;
  trustSell: number;
  trustNet: number;
  dealerBuy: number;
  dealerSell: number;
  dealerNet: number;
  totalBuy: number;
  totalSell: number;
  totalNet: number;
};

function buildInstitutionalSummary(
  label: TwseInstitutionalInvestorLabel,
  tradeDate: string,
  sourceUrl: string,
  fetchedAt: string,
  rows: ParsedInstitutionalRow[],
): TwseInstitutionalTradingSummary {
  const valueFor = (row: ParsedInstitutionalRow) => {
    if (label === "外資") return { buy: row.foreignBuy, sell: row.foreignSell, net: row.foreignNet };
    if (label === "投信") return { buy: row.trustBuy, sell: row.trustSell, net: row.trustNet };
    if (label === "自營商") return { buy: row.dealerBuy, sell: row.dealerSell, net: row.dealerNet };
    return { buy: row.totalBuy, sell: row.totalSell, net: row.totalNet };
  };
  const mapped = rows.map((row) => ({ ...row, ...valueFor(row) }));
  const buyShares = mapped.reduce((sum, row) => sum + row.buy, 0);
  const sellShares = mapped.reduce((sum, row) => sum + row.sell, 0);
  const netShares = mapped.reduce((sum, row) => sum + row.net, 0);
  const byNet = mapped.slice().sort((a, b) => b.net - a.net);

  return {
    label,
    tradeDate,
    sourceUrl,
    sourceUrls: [sourceUrl],
    fetchedAt,
    netShares,
    buyShares,
    sellShares,
    topBuys: byNet.filter((row) => row.net > 0).slice(0, 5).map((row) => ({
      symbol: row.symbol,
      companyName: row.companyName,
      netShares: row.net,
    })),
    topSells: byNet.filter((row) => row.net < 0).slice(-5).reverse().map((row) => ({
      symbol: row.symbol,
      companyName: row.companyName,
      netShares: row.net,
    })),
    qualityStatus: "verified",
    market: "TWSE",
  };
}

export function parseTwseInstitutionalTrading(
  payload: TwseForeignTradingResponse,
  sourceUrl: string,
  fetchedAt: string,
): TwseInstitutionalTradingSummary[] {
  if (payload.stat !== "OK" || !Array.isArray(payload.data) || payload.data.length === 0) {
    return [];
  }

  const tradeDate = parseTwseCalendarDate(payload.date);
  const rows = payload.data.flatMap((row): ParsedInstitutionalRow[] => {
    const symbol = row[0]?.trim();
    const companyName = row[1]?.trim();
    const foreignBuy = (parseSignedNumber(row[2]) ?? 0) + (parseSignedNumber(row[5]) ?? 0);
    const foreignSell = (parseSignedNumber(row[3]) ?? 0) + (parseSignedNumber(row[6]) ?? 0);
    const foreignNet = (parseSignedNumber(row[4]) ?? 0) + (parseSignedNumber(row[7]) ?? 0);
    const trustBuy = parseSignedNumber(row[8]);
    const trustSell = parseSignedNumber(row[9]);
    const trustNet = parseSignedNumber(row[10]);
    const dealerNet = parseSignedNumber(row[11]);
    const dealerSelfBuy = parseSignedNumber(row[12]) ?? 0;
    const dealerSelfSell = parseSignedNumber(row[13]) ?? 0;
    const dealerHedgeBuy = parseSignedNumber(row[15]) ?? 0;
    const dealerHedgeSell = parseSignedNumber(row[16]) ?? 0;
    const totalNet = parseSignedNumber(row[18]);
    if (!symbol || !companyName || trustBuy === null || trustSell === null || trustNet === null || dealerNet === null || totalNet === null) {
      return [];
    }
    const dealerBuy = dealerSelfBuy + dealerHedgeBuy;
    const dealerSell = dealerSelfSell + dealerHedgeSell;
    return [{
      symbol: `${symbol}.TW`,
      companyName,
      foreignBuy,
      foreignSell,
      foreignNet,
      trustBuy,
      trustSell,
      trustNet,
      dealerBuy,
      dealerSell,
      dealerNet,
      totalBuy: foreignBuy + trustBuy + dealerBuy,
      totalSell: foreignSell + trustSell + dealerSell,
      totalNet,
    }];
  });

  if (rows.length === 0) return [];
  return (["外資", "投信", "自營商", "三大法人"] as const)
    .map((label) => buildInstitutionalSummary(label, tradeDate, sourceUrl, fetchedAt, rows));
}

export async function fetchTwseInstitutionalTrading(options?: {
  date?: string;
}) {
  const fetchedAt = new Date().toISOString();
  const date = options?.date ?? fetchedAt.slice(0, 10);
  const url = twseInstitutionalTradingUrl(date);
  const payload = await fetchJson<TwseForeignTradingResponse>(url);
  return parseTwseInstitutionalTrading(payload, url, fetchedAt);
}


function eachCalendarDate(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return dates;
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function fetchTwseInstitutionalTradingRange(options: {
  startDate: string;
  endDate: string;
}) {
  const dates = eachCalendarDate(options.startDate, options.endDate);
  const daily = await Promise.all(dates.map(async (date) => {
    try {
      return await fetchTwseInstitutionalTrading({ date });
    } catch {
      return [];
    }
  }));
  return daily.flat().sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
}
export async function syncTwseResearchData(options?: {
  dryRun?: boolean;
  includeActions?: boolean;
  includePrices?: boolean;
  includeIndices?: boolean;
  indexDate?: string;
}) {
  const dryRun = options?.dryRun ?? true;
  const includeActions = options?.includeActions ?? true;
  const includePrices = options?.includePrices ?? true;
  const includeIndices = options?.includeIndices ?? true;
  const [actions, prices, indexPrices] = await Promise.all([
    includeActions ? fetchTwseCompanyActions() : Promise.resolve([]),
    includePrices ? fetchTwseDailyPrices() : Promise.resolve([]),
    includeIndices ? fetchTwseTaiexIndexPrices({ date: options?.indexDate }) : Promise.resolve([]),
  ]);
  const allPrices = [...prices, ...indexPrices];

  const dates = [...new Set([
    ...actions.map((item) => item.publishedAt.slice(0, 10)),
    ...allPrices.map((item) => item.price_date),
  ])].sort();

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      source: twseSource.name,
      actionCount: actions.length,
      priceCount: allPrices.length,
      equityPriceCount: prices.length,
      indexPriceCount: indexPrices.length,
      dates,
      actionSamples: actions.slice(0, 3),
      priceSamples: allPrices.slice(0, 3),
    };
  }

  await upsertResearchSources([twseSource]);
  const actionResult = await upsertCompanyActions(actions);
  const supabase = getSupabaseAdmin();
  const { error: priceError } = await supabase
    .from("stock_prices")
    .upsert(allPrices, { onConflict: "symbol,market,price_date" });
  if (priceError) throw priceError;

  return {
    ok: true,
    dryRun: false,
    source: twseSource.name,
    actionCount: actionResult.count,
    priceCount: allPrices.length,
    equityPriceCount: prices.length,
    indexPriceCount: indexPrices.length,
    dates,
  };
}










