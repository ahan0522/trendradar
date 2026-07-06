import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  fetchValidatedStockPriceOnOrAfter,
  fetchValidatedStockPriceOnOrBefore,
} from "@/lib/signals/price-fetcher";
import { upsertStockPrices } from "@/lib/signals/stock-prices";
import type { MarketCode, StockPrice } from "@/types/signals";

type SignalRow = {
  id: string;
  signal_date: string;
  signal_type: string;
  model_version: string | null;
};

type WatchlistRow = {
  signal_event_id: string;
  symbol: string;
  market: MarketCode;
};

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function benchmarkFor(signalType: string, markets: MarketCode[]) {
  if (markets.length > 0 && markets.every((market) => market === "TW")) {
    return { symbol: "0050.TW", market: "TW" as MarketCode };
  }
  if (signalType === "mixed") return { symbol: "QQQ", market: "US" as MarketCode };
  return { symbol: "SPY", market: "US" as MarketCode };
}

export async function backfillVerifiedSignalPrices(options?: {
  signalEventId?: string;
  signalIdPrefix?: string;
  modelVersions?: string[];
  signalLimit?: number;
  dryRun?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const signalLimit = Math.max(1, Math.min(options?.signalLimit ?? 10, 100));
  let signalQuery = supabase
    .from("signal_events")
    .select("id, signal_date, signal_type, model_version")
    .order("signal_date", { ascending: false })
    .limit(signalLimit);
  if (options?.signalEventId) signalQuery = signalQuery.eq("id", options.signalEventId);
  if (options?.signalIdPrefix) signalQuery = signalQuery.like("id", `${options.signalIdPrefix}%`);
  if (options?.modelVersions?.length) {
    signalQuery = signalQuery.in("model_version", options.modelVersions);
  }

  const { data: signals, error: signalError } = await signalQuery.returns<SignalRow[]>();
  if (signalError) throw signalError;
  const signalIds = (signals ?? []).map((item) => item.id);
  if (signalIds.length === 0) return { ok: true, dryRun: Boolean(options?.dryRun), signalCount: 0, fetched: 0, upserted: 0, skipped: [] };

  const { data: watchlists, error: watchlistError } = await supabase
    .from("signal_watchlists")
    .select("signal_event_id, symbol, market")
    .in("signal_event_id", signalIds)
    .returns<WatchlistRow[]>();
  if (watchlistError) throw watchlistError;

  const signalById = new Map((signals ?? []).map((item) => [item.id, item]));
  const today = currentTaipeiDate();
  const requests = new Map<string, { symbol: string; market: MarketCode; date: string; direction: "after" | "before" }>();

  const watchlistsBySignal = new Map<string, WatchlistRow[]>();
  for (const item of watchlists ?? []) {
    const rows = watchlistsBySignal.get(item.signal_event_id) ?? [];
    rows.push(item);
    watchlistsBySignal.set(item.signal_event_id, rows);
  }

  const queueItem = (symbol: string, market: MarketCode, signalDate: string) => {
    requests.set(`${symbol}|${market}|${signalDate}|after`, {
      symbol,
      market,
      date: signalDate,
      direction: "after",
    });
    for (const horizon of [7, 14, 30, 60, 90]) {
      const evaluationDate = addDays(signalDate, horizon);
      if (evaluationDate > today) continue;
      requests.set(`${symbol}|${market}|${evaluationDate}|before`, {
        symbol,
        market,
        date: evaluationDate,
        direction: "before",
      });
    }
  };

  for (const item of watchlists ?? []) {
    const signal = signalById.get(item.signal_event_id);
    if (!signal) continue;
    queueItem(item.symbol, item.market, signal.signal_date);
  }

  for (const signal of signals ?? []) {
    const markets = (watchlistsBySignal.get(signal.id) ?? []).map((item) => item.market);
    const benchmark = benchmarkFor(signal.signal_type, markets);
    queueItem(benchmark.symbol, benchmark.market, signal.signal_date);
  }

  const prices: StockPrice[] = [];
  const skipped: Array<{ symbol: string; date: string; direction: string; reason: string }> = [];
  const pendingRequests = [...requests.values()];
  const batchSize = 4;
  for (let offset = 0; offset < pendingRequests.length; offset += batchSize) {
    const batch = pendingRequests.slice(offset, offset + batchSize);
    const results = await Promise.all(
      batch.map((request) =>
        request.direction === "after"
          ? fetchValidatedStockPriceOnOrAfter(request)
          : fetchValidatedStockPriceOnOrBefore(request),
      ),
    );
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const request = batch[index];
      if (result.price) prices.push(result.price);
      else skipped.push({
        symbol: request.symbol,
        date: request.date,
        direction: request.direction,
        reason: [...result.errors, ...result.warnings].join(" ") || "No verified price",
      });
    }
  }

  const uniquePrices = [...new Map(prices.map((item) => [`${item.symbol}|${item.market}|${item.priceDate}`, item])).values()];
  const writeResult = options?.dryRun ? { count: 0 } : await upsertStockPrices(uniquePrices);
  return {
    ok: true,
    dryRun: Boolean(options?.dryRun),
    signalCount: signalIds.length,
    requestCount: requests.size,
    fetched: uniquePrices.length,
    upserted: writeResult.count,
    skipped,
    samples: uniquePrices.slice(0, 5),
  };
}

export const backfillVerifiedTwsePrices = backfillVerifiedSignalPrices;
