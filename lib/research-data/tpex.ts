import { getSupabaseAdmin } from "@/lib/supabase-server";
import { upsertResearchSources } from "@/lib/research-data/repository";
import type { ResearchSource } from "@/types/research-data";

const TPEX_PRICES_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes";

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

export async function syncTpexResearchData(options?: { dryRun?: boolean }) {
  const dryRun = options?.dryRun ?? true;
  const prices = await fetchTpexDailyPrices();
  const dates = [...new Set(prices.map((item) => item.price_date))].sort();

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      source: tpexSource.name,
      priceCount: prices.length,
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
    dates,
  };
}
