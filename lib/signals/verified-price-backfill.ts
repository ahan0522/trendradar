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

export async function backfillVerifiedTwsePrices(options?: {
  signalEventId?: string;
  signalLimit?: number;
  dryRun?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const signalLimit = Math.max(1, Math.min(options?.signalLimit ?? 10, 50));
  let signalQuery = supabase
    .from("signal_events")
    .select("id, signal_date")
    .order("signal_date", { ascending: false })
    .limit(signalLimit);
  if (options?.signalEventId) signalQuery = signalQuery.eq("id", options.signalEventId);

  const { data: signals, error: signalError } = await signalQuery.returns<SignalRow[]>();
  if (signalError) throw signalError;
  const signalIds = (signals ?? []).map((item) => item.id);
  if (signalIds.length === 0) return { ok: true, dryRun: Boolean(options?.dryRun), signalCount: 0, fetched: 0, upserted: 0, skipped: [] };

  const { data: watchlists, error: watchlistError } = await supabase
    .from("signal_watchlists")
    .select("signal_event_id, symbol, market")
    .in("signal_event_id", signalIds)
    .eq("market", "TW")
    .returns<WatchlistRow[]>();
  if (watchlistError) throw watchlistError;

  const signalById = new Map((signals ?? []).map((item) => [item.id, item]));
  const today = currentTaipeiDate();
  const requests = new Map<string, { symbol: string; market: MarketCode; date: string; direction: "after" | "before" }>();

  for (const item of watchlists ?? []) {
    const signal = signalById.get(item.signal_event_id);
    if (!signal) continue;
    requests.set(`${item.symbol}|${signal.signal_date}|after`, {
      symbol: item.symbol,
      market: "TW",
      date: signal.signal_date,
      direction: "after",
    });
    for (const horizon of [7, 14, 30, 60]) {
      const evaluationDate = addDays(signal.signal_date, horizon);
      if (evaluationDate > today) continue;
      requests.set(`${item.symbol}|${evaluationDate}|before`, {
        symbol: item.symbol,
        market: "TW",
        date: evaluationDate,
        direction: "before",
      });
    }
  }

  const prices: StockPrice[] = [];
  const skipped: Array<{ symbol: string; date: string; direction: string; reason: string }> = [];
  for (const request of requests.values()) {
    const result = request.direction === "after"
      ? await fetchValidatedStockPriceOnOrAfter(request)
      : await fetchValidatedStockPriceOnOrBefore(request);
    if (result.price) prices.push(result.price);
    else skipped.push({
      symbol: request.symbol,
      date: request.date,
      direction: request.direction,
      reason: [...result.errors, ...result.warnings].join(" ") || "No verified price",
    });
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
