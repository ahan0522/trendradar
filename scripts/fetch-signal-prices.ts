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

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        regularMarketTime?: number;
        regularMarketVolume?: number;
      };
    }>;
    error?: unknown;
  };
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function yahooCandidates(symbol: string, market: MarketCode) {
  const normalized = normalizeSymbol(symbol);
  if (market === "TW" && normalized.endsWith(".TW")) {
    return [normalized, normalized.replace(".TW", ".TWO")];
  }
  return [normalized];
}

async function fetchYahooLatestPrice(symbol: string, market: MarketCode): Promise<StockPrice | null> {
  for (const candidate of yahooCandidates(symbol, market)) {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate)}?range=1d&interval=1d`, {
      headers: {
        accept: "application/json",
        "user-agent": "TrendRadar/1.0 signal price validation",
      },
      cache: "no-store",
    });

    if (!response.ok) continue;

    const payload = (await response.json()) as YahooChartResponse;
    const meta = payload.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const time = meta?.regularMarketTime;

    if (!price || price <= 0 || !time) continue;

    return {
      symbol: normalizeSymbol(symbol),
      market,
      priceDate: new Date(time * 1000).toISOString().slice(0, 10),
      close: Number(price),
      adjClose: Number(price),
      volume: meta.regularMarketVolume,
    };
  }

  return null;
}

async function fetchLatestPrice(symbol: string, market: MarketCode, date: string) {
  if (market === "TW") {
    const twse = await fetchValidatedStockPriceOnOrBefore({ symbol, market, date }, 14);
    if (twse.price) return twse.price;
  }

  return fetchYahooLatestPrice(symbol, market);
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
