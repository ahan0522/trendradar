import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { MarketCode, StockPrice } from "@/types/signals";

type StockPriceRow = {
  symbol: string;
  market: MarketCode;
  price_date: string;
  close: number;
  adj_close: number | null;
  volume: number | null;
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
  };
}

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

    if (!close || close <= 0) {
      throw new Error(`Invalid close price at CSV row ${index + 2}`);
    }

    return {
      symbol: get("symbol").toUpperCase(),
      market: get("market").toUpperCase() as MarketCode,
      priceDate: toIsoDate(get("date")),
      close,
      adjClose: parseNumber(get("adj_close")),
      volume: parseNumber(get("volume")),
    };
  });
}

export async function upsertStockPrices(prices: StockPrice[]) {
  if (prices.length === 0) return { count: 0 };

  const supabase = getSupabaseAdmin();
  const rows = prices.map((price) => ({
    symbol: price.symbol,
    market: price.market,
    price_date: price.priceDate,
    close: price.close,
    adj_close: price.adjClose ?? null,
    volume: price.volume ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("stock_prices")
    .upsert(rows, { onConflict: "symbol,market,price_date" });

  if (error) throw error;
  return { count: rows.length };
}

export async function getPriceOnOrAfter(symbol: string, market: MarketCode, date: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("stock_prices")
    .select("symbol, market, price_date, close, adj_close, volume")
    .eq("symbol", symbol)
    .eq("market", market)
    .gte("price_date", date)
    .order("price_date", { ascending: true })
    .limit(1)
    .returns<StockPriceRow[]>();

  if (error) throw error;
  return data?.[0] ? mapRow(data[0]) : null;
}

export async function getPriceOnOrBefore(symbol: string, market: MarketCode, date: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("stock_prices")
    .select("symbol, market, price_date, close, adj_close, volume")
    .eq("symbol", symbol)
    .eq("market", market)
    .lte("price_date", date)
    .order("price_date", { ascending: false })
    .limit(1)
    .returns<StockPriceRow[]>();

  if (error) throw error;
  return data?.[0] ? mapRow(data[0]) : null;
}

export function calculateReturn(startPrice: number, endPrice: number) {
  if (startPrice <= 0) return 0;
  return ((endPrice - startPrice) / startPrice) * 100;
}
