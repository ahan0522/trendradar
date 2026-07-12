import { getSupabaseAdmin } from "@/lib/supabase-server";
import { assessLatestPrice } from "@/lib/signals/price-quality";
import type { MarketCode, StockPrice } from "@/types/signals";

type StockPriceRow = {
  symbol: string;
  market: MarketCode;
  price_date: string;
  close: number;
  adj_close: number | null;
  volume: number | null;
  quality_status?: string | null;
  provider?: string | null;
  source_url?: string | null;
  verification_provider?: string | null;
};

function parseNumber(value: string | undefined) {
  if (!value || value.trim() === "") return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toIsoDate(value: string) {
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date in CSV: ${value}`);
  }
  return date.toISOString().slice(0, 10);
}

function mapRow(row: StockPriceRow): StockPrice {
  return {
    symbol: row.symbol,
    market: row.market,
    priceDate: row.price_date,
    close: Number(row.close),
    adjClose: row.adj_close === null ? undefined : Number(row.adj_close),
    volume: row.volume === null ? undefined : Number(row.volume),
    qualityStatus: row.quality_status as StockPrice["qualityStatus"],
    provider: row.provider ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    verificationProvider: row.verification_provider ?? undefined,
  };
}

export function isBacktestPriceUsable(price: StockPrice) {
  return assessLatestPrice(price.symbol, price.market, {
    priceDate: price.priceDate,
    close: price.close,
    adjClose: price.adjClose ?? null,
    volume: price.volume ?? null,
    qualityStatus: price.qualityStatus,
    provider: price.provider,
    sourceUrl: price.sourceUrl,
    verificationProvider: price.verificationProvider,
  }).status === "verified";
}

const supportedMarkets: MarketCode[] = ["US", "TW", "KR", "JP", "GLOBAL"];
const supportedQualityStatuses: NonNullable<StockPrice["qualityStatus"]>[] = [
  "unverified",
  "verified",
  "needs_review",
  "rejected",
];

export function parseStockPriceCsv(csvText: string): StockPrice[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  const required = ["symbol", "market", "date", "close"];
  for (const header of required) {
    if (!headers.includes(header)) {
      throw new Error(`CSV missing required column: ${header}`);
    }
  }

  return lines.slice(1).map((line, index) => {
    const values = line.split(",").map((value) => value.trim());
    const get = (name: string) => values[headers.indexOf(name)];
    const close = parseNumber(get("close"));
    const market = get("market").toUpperCase() as MarketCode;
    const qualityStatus = get("quality_status") as StockPrice["qualityStatus"];

    if (!close || close <= 0) {
      throw new Error(`Invalid close price at CSV row ${index + 2}`);
    }
    if (!supportedMarkets.includes(market)) {
      throw new Error(`Unsupported market at CSV row ${index + 2}: ${market}`);
    }
    if (qualityStatus && !supportedQualityStatuses.includes(qualityStatus)) {
      throw new Error(`Unsupported quality_status at CSV row ${index + 2}: ${qualityStatus}`);
    }

    return {
      symbol: get("symbol").toUpperCase(),
      market,
      priceDate: toIsoDate(get("date")),
      close,
      adjClose: parseNumber(get("adj_close")),
      volume: parseNumber(get("volume")),
      provider: get("provider") || undefined,
      sourceUrl: get("source_url") || undefined,
      fetchedAt: get("fetched_at") || undefined,
      qualityStatus: qualityStatus || undefined,
      verificationProvider: get("verification_provider") || undefined,
    };
  });
}

export async function upsertStockPrices(
  prices: StockPrice[],
  options: { preserveVerified?: boolean } = {},
) {
  if (prices.length === 0) return { count: 0 };

  const supabase = getSupabaseAdmin();
  let writablePrices = prices;
  if (options.preserveVerified && prices.some((price) => price.qualityStatus !== "verified")) {
    const dates = prices.map((price) => price.priceDate).sort();
    const { data, error } = await supabase
      .from("stock_prices")
      .select("symbol, market, price_date, quality_status")
      .in("symbol", [...new Set(prices.map((price) => price.symbol))])
      .in("market", [...new Set(prices.map((price) => price.market))])
      .gte("price_date", dates[0])
      .lte("price_date", dates.at(-1) ?? dates[0])
      .eq("quality_status", "verified")
      .returns<StockPriceRow[]>();
    if (error) throw error;
    const verifiedKeys = new Set((data ?? []).map((row) => `${row.symbol}|${row.market}|${row.price_date}`));
    writablePrices = prices.filter((price) =>
      price.qualityStatus === "verified" ||
      !verifiedKeys.has(`${price.symbol}|${price.market}|${price.priceDate}`));
  }

  if (writablePrices.length === 0) return { count: 0 };
  const rows = writablePrices.map((price) => {
    if (price.qualityStatus === "verified" && (!price.provider || !price.sourceUrl)) {
      throw new Error(`Verified price ${price.symbol} ${price.priceDate} requires provider and source_url`);
    }
    return {
      symbol: price.symbol,
      market: price.market,
      price_date: price.priceDate,
      close: price.close,
      adj_close: price.adjClose ?? null,
      volume: price.volume ?? null,
      ...(price.provider ? { provider: price.provider } : {}),
      ...(price.sourceUrl ? { source_url: price.sourceUrl } : {}),
      ...(price.fetchedAt ? { fetched_at: price.fetchedAt } : {}),
      ...(price.qualityStatus ? { quality_status: price.qualityStatus } : {}),
      ...(price.verificationProvider ? { verification_provider: price.verificationProvider } : {}),
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("stock_prices")
    .upsert(rows, { onConflict: "symbol,market,price_date" });

  if (error) throw error;
  return { count: rows.length };
}

export async function getPriceOnOrAfter(
  symbol: string,
  market: MarketCode,
  date: string,
  maxDate?: string,
) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("stock_prices")
    .select("symbol, market, price_date, close, adj_close, volume, quality_status, provider, source_url, verification_provider")
    .eq("symbol", symbol)
    .eq("market", market)
    .eq("quality_status", "verified")
    .gte("price_date", date);
  if (market === "TW") query = query.like("verification_provider", "%yahoo-adjustment-v1%");
  if (maxDate) query = query.lte("price_date", maxDate);
  const { data, error } = await query
    .order("price_date", { ascending: true })
    .limit(1)
    .returns<StockPriceRow[]>();

  if (error?.code === "42703") return null;
  if (error) throw error;
  const price = data?.[0] ? mapRow(data[0]) : null;
  return price && isBacktestPriceUsable(price) ? price : null;
}

export async function getPriceOnOrBefore(
  symbol: string,
  market: MarketCode,
  date: string,
  minDate?: string,
) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("stock_prices")
    .select("symbol, market, price_date, close, adj_close, volume, quality_status, provider, source_url, verification_provider")
    .eq("symbol", symbol)
    .eq("market", market)
    .eq("quality_status", "verified")
    .lte("price_date", date);
  if (market === "TW") query = query.like("verification_provider", "%yahoo-adjustment-v1%");
  if (minDate) query = query.gte("price_date", minDate);
  const { data, error } = await query
    .order("price_date", { ascending: false })
    .limit(1)
    .returns<StockPriceRow[]>();

  if (error?.code === "42703") return null;
  if (error) throw error;
  const price = data?.[0] ? mapRow(data[0]) : null;
  return price && isBacktestPriceUsable(price) ? price : null;
}

export function calculateReturn(startPrice: number, endPrice: number) {
  if (startPrice <= 0) return 0;
  return ((endPrice - startPrice) / startPrice) * 100;
}
