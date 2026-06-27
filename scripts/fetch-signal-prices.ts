import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { fetchValidatedStockPriceOnOrBefore } from "@/lib/signals/price-fetcher";
import { upsertStockPrices } from "@/lib/signals/stock-prices";
import type { MarketCode, StockPrice } from "@/types/signals";

loadEnvConfig(process.cwd());

type WatchlistRow = {
  symbol: string;
  market: MarketCode;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

async function fetchLatestPrice(symbol: string, market: MarketCode, date: string) {
  const result = await fetchValidatedStockPriceOnOrBefore({ symbol, market, date }, 14);
  return result.price;
}

async function main() {
  const asOfDate = process.argv[2] ?? todayIso();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("signal_watchlists")
    .select("symbol, market")
    .returns<WatchlistRow[]>();

  if (error) throw error;

  const unique = new Map<string, WatchlistRow>();
  for (const row of data ?? []) {
    unique.set(`${normalizeSymbol(row.symbol)}::${row.market}`, {
      symbol: normalizeSymbol(row.symbol),
      market: row.market,
    });
  }

  const prices: StockPrice[] = [];
  const skipped: string[] = [];

  for (const item of unique.values()) {
    try {
      const price = await fetchLatestPrice(item.symbol, item.market, asOfDate);
      if (price) {
        prices.push(price);
      } else {
        skipped.push(`${item.symbol} ${item.market}`);
      }
    } catch (error) {
      skipped.push(`${item.symbol} ${item.market}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const result = await upsertStockPrices(prices);
  console.log(`Fetched ${prices.length} latest prices as of ${asOfDate}; upserted ${result.count}.`);
  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length}: ${skipped.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
