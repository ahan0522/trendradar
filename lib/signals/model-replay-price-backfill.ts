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

type SkippedPrice = {
  symbol: string;
  date: string;
  reason: string;
};

export function normalizeReplayPriceSkipReason(reason: string) {
  if (/Cross-source adjusted close gap/i.test(reason)) return "corporate_action_adjustment_gap";
  if (/Cross-source close mismatch/i.test(reason)) return "cross_source_close_mismatch";
  if (/Cross-source date mismatch/i.test(reason)) return "cross_source_date_mismatch";
  if (/超出合理區間/i.test(reason)) return "sanity_range_rejected";
  if (/could not be paired with an adjusted close/i.test(reason)) return "missing_adjusted_close_pair";
  if (/No .* price found/i.test(reason)) return "no_price_found";
  if (/HTTP \d+/i.test(reason)) return "provider_http_error";
  return "other";
}

function summarizeSkipped(skipped: SkippedPrice[]) {
  const bySymbol = new Map<string, { symbol: string; count: number; reasons: Map<string, number> }>();
  const byReason = new Map<string, number>();
  for (const item of skipped) {
    const reasonKey = normalizeReplayPriceSkipReason(item.reason);
    byReason.set(reasonKey, (byReason.get(reasonKey) ?? 0) + 1);
    const current = bySymbol.get(item.symbol) ?? { symbol: item.symbol, count: 0, reasons: new Map<string, number>() };
    current.count += 1;
    current.reasons.set(reasonKey, (current.reasons.get(reasonKey) ?? 0) + 1);
    bySymbol.set(item.symbol, current);
  }
  return {
    byReason: [...byReason.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    bySymbol: [...bySymbol.values()]
      .map((item) => ({
        symbol: item.symbol,
        count: item.count,
        reasons: [...item.reasons.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
      }))
      .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol)),
  };
}

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
  excludedSymbols?: string[];
}) {
  const replay = await getLatestModelReplay(options?.runId);
  if (!replay) throw new Error("Model replay run not found");
  const backtest = await getModelReplayBacktestResults(replay.id);
  const horizons = options?.horizons ?? [30];
  const maxSymbols = Math.max(1, Math.min(options?.maxSymbols ?? 8, 50));
  const excludedSymbols = new Set((options?.excludedSymbols ?? []).map((symbol) => symbol.toUpperCase()));

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
    .filter((item) => !excludedSymbols.has(item.symbol.toUpperCase()))
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
  const skipped: SkippedPrice[] = [];
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
    skippedSummary: summarizeSkipped(skipped),
    skipped,
  };
}
