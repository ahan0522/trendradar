import { addDays } from "@/lib/signals/backtest";
import {
  fetchValidatedStockPriceOnOrAfter,
  fetchValidatedStockPriceOnOrBefore,
} from "@/lib/signals/price-fetcher";
import { getModelReplayBacktestResults } from "@/lib/signals/model-replay-backtest";
import { getLatestModelReplay } from "@/lib/signals/model-replay";
import { upsertStockPrices } from "@/lib/signals/stock-prices";
import type { MarketCode, StockPrice } from "@/types/signals";

type PriceRequest = {
  symbol: string;
  market: MarketCode;
  date: string;
  direction: "after" | "before";
};

function benchmarkFor(markets: MarketCode[]) {
  if (markets.length > 0 && markets.every((market) => market === "TW")) {
    return { symbol: "0050.TW", market: "TW" as MarketCode };
  }
  return { symbol: "SPY", market: "US" as MarketCode };
}

export async function backfillVerifiedReplayPrices(options?: {
  runId?: string;
  horizons?: number[];
  maxSymbols?: number;
  dryRun?: boolean;
}) {
  const replay = await getLatestModelReplay(options?.runId);
  if (!replay) throw new Error("Model replay run not found");
  const backtest = await getModelReplayBacktestResults(replay.id);
  const horizons = options?.horizons ?? [30];
  const maxSymbols = Math.max(1, Math.min(options?.maxSymbols ?? 8, 50));

  const frequency = new Map<string, { symbol: string; market: MarketCode; count: number }>();
  for (const result of backtest.results) {
    if (result.mappingStatus !== "missing_prices") continue;
    for (const item of result.watchlist) {
      if (!result.missingPrices.includes(item.symbol)) continue;
      const key = `${item.symbol}|${item.market}`;
      const current = frequency.get(key);
      frequency.set(key, {
        symbol: item.symbol,
        market: item.market,
        count: (current?.count ?? 0) + 1,
      });
    }
    for (const outcome of result.outcomes) {
      if (!result.missingPrices.includes(outcome.benchmarkSymbol)) continue;
      const key = `${outcome.benchmarkSymbol}|${outcome.benchmarkMarket}`;
      const current = frequency.get(key);
      frequency.set(key, {
        symbol: outcome.benchmarkSymbol,
        market: outcome.benchmarkMarket,
        count: (current?.count ?? 0) + 1,
      });
    }
  }

  const selected = [...frequency.values()]
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol))
    .slice(0, maxSymbols);
  const selectedKeys = new Set(selected.map((item) => `${item.symbol}|${item.market}`));
  const requests = new Map<string, PriceRequest>();

  for (const result of backtest.results) {
    if (result.watchlist.length === 0) continue;
    const benchmark = benchmarkFor(result.watchlist.map((item) => item.market));
    const instruments = [
      ...result.watchlist.map((item) => ({ symbol: item.symbol, market: item.market })),
      benchmark,
    ];
    for (const instrument of instruments) {
      if (!selectedKeys.has(`${instrument.symbol}|${instrument.market}`)) continue;
      requests.set(`${instrument.symbol}|${instrument.market}|${result.signalDate}|after`, {
        ...instrument,
        date: result.signalDate,
        direction: "after",
      });
      for (const horizonDays of horizons) {
        const date = addDays(result.signalDate, horizonDays);
        requests.set(`${instrument.symbol}|${instrument.market}|${date}|before`, {
          ...instrument,
          date,
          direction: "before",
        });
      }
    }
  }

  const prices: StockPrice[] = [];
  const skipped: Array<{ symbol: string; date: string; reason: string }> = [];
  const queue = [...requests.values()];
  for (let offset = 0; offset < queue.length; offset += 3) {
    const batch = queue.slice(offset, offset + 3);
    const results = await Promise.all(batch.map((request) =>
      request.direction === "after"
        ? fetchValidatedStockPriceOnOrAfter(request)
        : fetchValidatedStockPriceOnOrBefore(request),
    ));
    results.forEach((result, index) => {
      if (result.price) prices.push(result.price);
      else skipped.push({
        symbol: batch[index].symbol,
        date: batch[index].date,
        reason: [...result.errors, ...result.warnings].join(" ") || "No verified price",
      });
    });
  }

  const uniquePrices = [...new Map(
    prices.map((price) => [`${price.symbol}|${price.market}|${price.priceDate}`, price]),
  ).values()];
  const upserted = options?.dryRun ? { count: 0 } : await upsertStockPrices(uniquePrices);
  return {
    runId: replay.id,
    dryRun: Boolean(options?.dryRun),
    selectedSymbols: selected,
    requestCount: requests.size,
    fetched: uniquePrices.length,
    upserted: upserted.count,
    skipped,
  };
}
