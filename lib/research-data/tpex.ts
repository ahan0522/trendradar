import { getSupabaseAdmin } from "@/lib/supabase-server";
import { upsertResearchSources } from "@/lib/research-data/repository";
import type { ResearchSource } from "@/types/research-data";

const TPEX_PRICES_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes";
const TPEX_OTC_INDEX_URL = "https://www.tpex.org.tw/www/zh-tw/indexInfo/inx";
const TPEX_OTC_INDEX_SYMBOL = "^TWOII";

type TpexPriceRow = {
  Date?: string;
  SecuritiesCompanyCode?: string;
  CompanyName?: string;
  Close?: string;
  Open?: string;
  High?: string;
  Low?: string;
  TradingShares?: string;
};

type TpexIndexResponse = {
  stat?: string;
  tables?: Array<{
    title?: string;
    fields?: string[];
    data?: string[][];
  }>;
};

const tpexSource: ResearchSource = {
  id: "tpex-openapi",
  name: "證券櫃檯買賣中心 OpenAPI",
  sourceType: "official",
  baseUrl: "https://www.tpex.org.tw/openapi/",
  authorityLevel: "primary",
  reliabilityScore: 95,
};

export function parseTpexRocDate(value: string | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 7) throw new Error(`Invalid TPEx ROC date: ${value ?? "missing"}`);
  const year = Number(digits.slice(0, 3)) + 1911;
  const result = `${year}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`;
  const parsed = new Date(`${result}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) {
    throw new Error(`Invalid TPEx ROC date: ${value ?? "missing"}`);
  }
  return result;
}

function parseTpexGregorianDate(value: string | undefined) {
  const match = (value ?? "").trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) throw new Error(`Invalid TPEx Gregorian date: ${value ?? "missing"}`);
  const result = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${result}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) {
    throw new Error(`Invalid TPEx Gregorian date: ${value ?? "missing"}`);
  }
  return result;
}

function parsePositiveNumber(value: string | undefined) {
  const normalized = value?.trim().replace(/,/g, "");
  if (!normalized || normalized === "---") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function fetchTpexJson<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "TrendRadar/1.0 research-data@trendradar",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`TPEx request failed: ${response.status} ${url}`);
  return (await response.json()) as T;
}

async function postTpexJson<T>(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "TrendRadar/1.0 research-data@trendradar",
    },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`TPEx request failed: ${response.status} ${url}`);
  return (await response.json()) as T;
}

function tpexIndexMonth(date?: string) {
  const source = date ?? new Date().toISOString().slice(0, 10);
  const match = source.match(/^(\d{4})-(\d{2})/);
  if (!match) throw new Error(`Invalid TPEx index date: ${date ?? "missing"}`);
  return `${match[1]}${match[2]}`;
}

function tpexOtcIndexSourceUrl(month: string) {
  return `${TPEX_OTC_INDEX_URL}?date=${month}&response=json`;
}

export function parseTpexOtcIndexPrices(response: TpexIndexResponse, sourceUrl: string, fetchedAt: string) {
  if (!response.tables?.length) return [];
  const table = response.tables.find((item) => item.title?.includes("櫃買指數")) ?? response.tables[0];
  const fields = table.fields ?? [];
  const dateIndex = fields.indexOf("日期");
  const openIndex = fields.indexOf("開市");
  const highIndex = fields.indexOf("最高");
  const lowIndex = fields.indexOf("最低");
  const closeIndex = fields.indexOf("收市");
  if ([dateIndex, openIndex, highIndex, lowIndex, closeIndex].some((index) => index < 0)) {
    throw new Error(`Unexpected TPEx OTC index fields: ${fields.join(",")}`);
  }

  return (table.data ?? []).flatMap((row) => {
    const close = parsePositiveNumber(row[closeIndex]);
    if (!close) return [];
    return [{
      symbol: TPEX_OTC_INDEX_SYMBOL,
      market: "TW",
      price_date: parseTpexGregorianDate(row[dateIndex]),
      open: parsePositiveNumber(row[openIndex]),
      high: parsePositiveNumber(row[highIndex]),
      low: parsePositiveNumber(row[lowIndex]),
      close,
      adj_close: close,
      volume: null,
      provider: tpexSource.id,
      source_url: sourceUrl,
      fetched_at: fetchedAt,
      quality_status: "verified",
      verified_at: fetchedAt,
      verification_provider: tpexSource.id,
      updated_at: fetchedAt,
    }];
  });
}

export async function fetchTpexDailyPrices() {
  const rows = await fetchTpexJson<TpexPriceRow[]>(TPEX_PRICES_URL);
  const fetchedAt = new Date().toISOString();

  return rows.flatMap((row) => {
    const code = row.SecuritiesCompanyCode?.trim();
    const close = parsePositiveNumber(row.Close);
    if (!code || !/^\d{4}$/.test(code) || !close || !row.Date) return [];

    return [{
      symbol: `${code}.TW`,
      market: "TW",
      price_date: parseTpexRocDate(row.Date),
      open: parsePositiveNumber(row.Open),
      high: parsePositiveNumber(row.High),
      low: parsePositiveNumber(row.Low),
      close,
      adj_close: close,
      volume: parsePositiveNumber(row.TradingShares),
      provider: tpexSource.id,
      source_url: TPEX_PRICES_URL,
      fetched_at: fetchedAt,
      quality_status: "verified",
      verified_at: fetchedAt,
      verification_provider: tpexSource.id,
      updated_at: fetchedAt,
    }];
  });
}

export async function fetchTpexOtcIndexPrices(options?: { date?: string }) {
  const month = tpexIndexMonth(options?.date);
  const sourceUrl = tpexOtcIndexSourceUrl(month);
  const response = await postTpexJson<TpexIndexResponse>(TPEX_OTC_INDEX_URL, {
    date: month,
    response: "json",
  });
  return parseTpexOtcIndexPrices(response, sourceUrl, new Date().toISOString());
}

export async function syncTpexResearchData(options?: {
  dryRun?: boolean;
  includePrices?: boolean;
  includeIndices?: boolean;
  indexDate?: string;
}) {
  const dryRun = options?.dryRun ?? true;
  const includePrices = options?.includePrices ?? true;
  const includeIndices = options?.includeIndices ?? true;
  const equityPrices = includePrices ? await fetchTpexDailyPrices() : [];
  const indexPrices = includeIndices ? await fetchTpexOtcIndexPrices({ date: options?.indexDate }) : [];
  const prices = [...equityPrices, ...indexPrices];
  const dates = [...new Set(prices.map((item) => item.price_date))].sort();

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      source: tpexSource.name,
      priceCount: prices.length,
      equityPriceCount: equityPrices.length,
      indexPriceCount: indexPrices.length,
      dates,
      priceSamples: prices.slice(0, 5),
    };
  }

  await upsertResearchSources([tpexSource]);
  const { error } = await getSupabaseAdmin()
    .from("stock_prices")
    .upsert(prices, { onConflict: "symbol,market,price_date" });
  if (error) throw error;

  return {
    ok: true,
    dryRun: false,
    source: tpexSource.name,
    priceCount: prices.length,
    equityPriceCount: equityPrices.length,
    indexPriceCount: indexPrices.length,
    dates,
  };
}


