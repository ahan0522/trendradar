import { marketBriefIndexPriceTargets } from "@/lib/reports/market-brief-price-targets";
import { fetchAndMaybeUpsertStockPrices } from "@/lib/signals/price-fetcher";

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
    return {
      ok: true,
      status: "skipped" as const,
      dryRun: Boolean(options.dryRun),
      startDate: options.startDate,
      endDate,
      targetCount: new Set(requests.map((item) => item.symbol)).size,
      requestCount: requests.length,
      fetched: 0,
      upserted: 0,
      reason: "ALPHA_VANTAGE_API_KEY is not configured; US report prices require Yahoo plus an independent same-date close.",
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
