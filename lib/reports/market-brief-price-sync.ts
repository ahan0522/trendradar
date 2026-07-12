import { marketBriefIndexPriceTargets } from "@/lib/reports/market-brief-price-targets";
import {
  fetchAndMaybeUpsertStockPrices,
  fetchProvisionalUsPriceOnOrBefore,
} from "@/lib/signals/price-fetcher";
import { upsertStockPrices } from "@/lib/signals/stock-prices";
import type { StockPrice } from "@/types/signals";

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function marketBriefPriceSyncDates(startDate: string, endDate: string) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
    throw new Error("Market brief price sync requires a valid YYYY-MM-DD date range.");
  }

  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function marketBriefUsPriceRequests(startDate: string, endDate: string) {
  const dates = marketBriefPriceSyncDates(startDate, endDate);
  const targets = marketBriefIndexPriceTargets().filter((target) => target.market === "US");
  return dates.flatMap((date) => targets.map((target) => ({
    symbol: target.symbol,
    market: "US" as const,
    date,
  })));
}

export async function syncMarketBriefUsPrices(options: {
  startDate: string;
  endDate?: string;
  dryRun?: boolean;
}) {
  const endDate = options.endDate ?? options.startDate;
  const requests = marketBriefUsPriceRequests(options.startDate, endDate);

  if (!process.env.ALPHA_VANTAGE_API_KEY?.trim()) {
    const results = [];
    for (const request of requests) {
      results.push(await fetchProvisionalUsPriceOnOrBefore(request, 7));
    }
    const uniquePrices = new Map<string, StockPrice>();
    for (const result of results) {
      if (result.status !== "fetched" || !result.price) continue;
      uniquePrices.set(
        `${result.price.symbol}|${result.price.market}|${result.price.priceDate}`,
        result.price,
      );
    }
    const prices = [...uniquePrices.values()];
    const upserted = options.dryRun
      ? { count: 0 }
      : await upsertStockPrices(prices, { preserveVerified: true });
    return {
      ok: results.every((result) => result.status !== "error"),
      status: prices.length > 0 ? ("success" as const) : ("skipped" as const),
      priceTier: "provisional" as const,
      dryRun: Boolean(options.dryRun),
      startDate: options.startDate,
      endDate,
      targetCount: new Set(requests.map((item) => item.symbol)).size,
      requestCount: requests.length,
      fetched: prices.length,
      upserted: upserted.count,
      skipped: results.filter((result) => result.status === "skipped").length,
      errors: results.flatMap((result) => result.errors.map((error) => `${result.symbol}: ${error}`)),
      reason: "Alpha Vantage is not configured; Yahoo single-source closes were stored as unverified for market-brief display only.",
    };
  }

  const result = await fetchAndMaybeUpsertStockPrices(requests, {
    dryRun: options.dryRun,
    lookbackDays: 7,
  });
  return {
    ...result,
    status: result.fetched > 0 ? ("success" as const) : ("skipped" as const),
    startDate: options.startDate,
    endDate,
    targetCount: new Set(requests.map((item) => item.symbol)).size,
    requestCount: requests.length,
  };
}
