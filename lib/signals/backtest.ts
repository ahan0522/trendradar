import { getSupabaseAdmin } from "@/lib/supabase-server";
import { calculateReturn, getPriceOnOrAfter, getPriceOnOrBefore } from "@/lib/signals/stock-prices";
import type { MarketCode, SignalOutcome } from "@/types/signals";

type SignalEventRow = {
  id: string;
  signal_date: string;
  signal_type: string;
};

type WatchlistRow = {
  id: string;
  signal_event_id: string;
  symbol: string;
  company_name: string;
  market: MarketCode;
  thesis: string;
  weight: number;
  source: string | null;
};

type OutcomeRow = {
  signal_event_id: string;
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: "success" | "partial" | "failed" | "pending";
};

export const SIGNAL_BACKTEST_HORIZONS = [7, 30, 60, 90] as const;

export type StockReturnDetail = {
  symbol: string;
  companyName: string;
  market: MarketCode;
  weight: number;
  entryPrice: number | null;
  entryDate: string | null;
  exitPrice: number | null;
  exitDate: string | null;
  returnPct: number | null;
};

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function isHorizonMature(signalDate: string, horizonDays: number, asOfDate = new Date().toISOString().slice(0, 10)) {
  return addDays(signalDate, horizonDays) <= asOfDate;
}

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isValidBacktestWindow(
  signalDate: string,
  targetDate: string,
  entryDate: string | null,
  exitDate: string | null,
) {
  if (!entryDate || !exitDate) return false;
  return entryDate >= signalDate && entryDate <= targetDate && exitDate >= entryDate && exitDate <= targetDate;
}

export function isPlausibleBacktestReturn(returnPct: number, horizonDays: number) {
  const maxAbsoluteReturn =
    horizonDays <= 7 ? 50 :
    horizonDays <= 14 ? 75 :
    horizonDays <= 30 ? 120 :
    horizonDays <= 60 ? 175 :
    250;
  return Number.isFinite(returnPct) && Math.abs(returnPct) <= maxAbsoluteReturn;
}

export function isPlausibleBasketReturn(returnPct: number) {
  return Number.isFinite(returnPct) && Math.abs(returnPct) <= 100;
}

function normalizeWeights(rows: WatchlistRow[]) {
  const total = rows.reduce((sum, row) => sum + Number(row.weight || 0), 0);
  if (total <= 0) return rows.map(() => 1 / Math.max(rows.length, 1));
  return rows.map((row) => Number(row.weight || 0) / total);
}

function defaultBenchmark(signalType: string, markets: MarketCode[]) {
  if (markets.every((market) => market === "TW")) return { symbol: "0050.TW", market: "TW" as MarketCode };
  if (signalType === "mixed") return { symbol: "QQQ", market: "US" as MarketCode };
  return { symbol: "SPY", market: "US" as MarketCode };
}

function mapOutcome(row: OutcomeRow): SignalOutcome {
  return {
    signalEventId: row.signal_event_id,
    horizonDays: Number(row.horizon_days),
    basketReturn: Number(row.basket_return),
    benchmarkReturn: Number(row.benchmark_return),
    excessReturn: Number(row.excess_return),
    outcome: row.outcome,
  };
}

export async function getSignalReturnDetails(signalEventId: string, horizonDays: number) {
  const supabase = getSupabaseAdmin();
  const [{ data: signalRows, error: signalError }, { data: watchlistRows, error: watchlistError }] = await Promise.all([
    supabase
      .from("signal_events")
      .select("id, signal_date, signal_type")
      .eq("id", signalEventId)
      .limit(1)
      .returns<SignalEventRow[]>(),
    supabase
      .from("signal_watchlists")
      .select("id, signal_event_id, symbol, company_name, market, thesis, weight, source")
      .eq("signal_event_id", signalEventId)
      .order("weight", { ascending: false })
      .returns<WatchlistRow[]>(),
  ]);

  if (signalError) throw signalError;
  if (watchlistError) throw watchlistError;

  const signal = signalRows?.[0];
  const watchlists = watchlistRows ?? [];
  if (!signal || watchlists.length === 0) {
    return { signal: signal ?? null, details: [] as StockReturnDetail[], basketReturn: null as number | null };
  }

  const exitDate = addDays(signal.signal_date, horizonDays);
  const weights = normalizeWeights(watchlists);
  if (!isHorizonMature(signal.signal_date, horizonDays)) {
    const entryCutoff = currentTaipeiDate();
    const details: StockReturnDetail[] = [];
    for (let index = 0; index < watchlists.length; index += 1) {
      const item = watchlists[index];
      const entry = await getPriceOnOrAfter(
        item.symbol,
        item.market,
        signal.signal_date,
        entryCutoff,
      );
      details.push({
        symbol: item.symbol,
        companyName: item.company_name,
        market: item.market,
        weight: weights[index],
        entryPrice: entry?.adjClose ?? entry?.close ?? null,
        entryDate: entry?.priceDate ?? null,
        exitPrice: null,
        exitDate: null,
        returnPct: null,
      });
    }
    return {
      signal,
      details,
      basketReturn: null as number | null,
    };
  }
  const details: StockReturnDetail[] = [];

  for (let index = 0; index < watchlists.length; index += 1) {
    const item = watchlists[index];
    const entry = await getPriceOnOrAfter(item.symbol, item.market, signal.signal_date, exitDate);
    const exit = await getPriceOnOrBefore(item.symbol, item.market, exitDate, entry?.priceDate ?? signal.signal_date);
    const entryValue = entry?.adjClose ?? entry?.close ?? null;
    const exitValue = exit?.adjClose ?? exit?.close ?? null;
    const validWindow = isValidBacktestWindow(
      signal.signal_date,
      exitDate,
      entry?.priceDate ?? null,
      exit?.priceDate ?? null,
    );
    const calculatedReturn = validWindow && entryValue !== null && exitValue !== null
      ? calculateReturn(entryValue, exitValue)
      : null;
    const returnPct = calculatedReturn !== null && isPlausibleBacktestReturn(calculatedReturn, horizonDays)
      ? calculatedReturn
      : null;

    details.push({
      symbol: item.symbol,
      companyName: item.company_name,
      market: item.market,
      weight: weights[index],
      entryPrice: entryValue,
      entryDate: entry?.priceDate ?? null,
      exitPrice: exitValue,
      exitDate: exit?.priceDate ?? null,
      returnPct,
    });
  }

  if (details.some((detail) => detail.returnPct === null)) {
    return { signal, details, basketReturn: null as number | null };
  }

  const basketReturn = details.reduce((sum, detail) => sum + (detail.returnPct ?? 0) * detail.weight, 0);
  return {
    signal,
    details,
    basketReturn: isPlausibleBasketReturn(basketReturn) ? basketReturn : null,
  };
}

export async function calculateSignalBasketReturn(signalEventId: string, horizonDays: number) {
  return getSignalReturnDetails(signalEventId, horizonDays);
}

export async function calculateBenchmarkReturn(
  benchmarkSymbol: string,
  market: MarketCode,
  signalDate: string,
  horizonDays: number,
) {
  const exitDate = addDays(signalDate, horizonDays);
  if (!isHorizonMature(signalDate, horizonDays)) return null;
  const entry = await getPriceOnOrAfter(benchmarkSymbol, market, signalDate, exitDate);
  const exit = await getPriceOnOrBefore(benchmarkSymbol, market, exitDate, entry?.priceDate ?? signalDate);
  const entryValue = entry?.adjClose ?? entry?.close ?? null;
  const exitValue = exit?.adjClose ?? exit?.close ?? null;

  if (
    entryValue === null ||
    exitValue === null ||
    !isValidBacktestWindow(signalDate, exitDate, entry?.priceDate ?? null, exit?.priceDate ?? null)
  ) return null;
  return calculateReturn(entryValue, exitValue);
}

export async function evaluateSignalOutcome(signalEventId: string, horizonDays: number) {
  const { signal, details, basketReturn } = await calculateSignalBasketReturn(signalEventId, horizonDays);
  if (!signal) throw new Error(`Signal not found: ${signalEventId}`);

  const benchmark = defaultBenchmark(signal.signal_type, details.map((detail) => detail.market));
  const benchmarkReturn = await calculateBenchmarkReturn(benchmark.symbol, benchmark.market, signal.signal_date, horizonDays);

  if (basketReturn === null || benchmarkReturn === null) {
    return {
      signalEventId,
      horizonDays,
      basketReturn: 0,
      benchmarkReturn: benchmarkReturn ?? 0,
      excessReturn: 0,
      outcome: "pending" as const,
      benchmark,
      details,
    };
  }

  const excessReturn = basketReturn - benchmarkReturn;
  const outcome = excessReturn >= 5 ? "success" : excessReturn >= 0 ? "partial" : "failed";

  return {
    signalEventId,
    horizonDays,
    basketReturn,
    benchmarkReturn,
    excessReturn,
    outcome,
    benchmark,
    details,
  };
}

export async function upsertSignalOutcome(result: Awaited<ReturnType<typeof evaluateSignalOutcome>>) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("signal_outcomes").upsert(
    {
      signal_event_id: result.signalEventId,
      horizon_days: result.horizonDays,
      basket_return: result.basketReturn,
      benchmark_symbol: result.benchmark.symbol,
      benchmark_market: result.benchmark.market,
      benchmark_return: result.benchmarkReturn,
      excess_return: result.excessReturn,
      outcome: result.outcome,
      details: result.details,
      evaluated_at: new Date().toISOString(),
    },
    { onConflict: "signal_event_id,horizon_days" },
  );

  if (error) throw error;
  return result;
}

export async function runBacktestForSignal(signalEventId: string) {
  const results = [];
  for (const horizonDays of SIGNAL_BACKTEST_HORIZONS) {
    const result = await evaluateSignalOutcome(signalEventId, horizonDays);
    results.push(await upsertSignalOutcome(result));
  }
  return results;
}

export async function runBacktestForAllSignals() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("signal_events")
    .select("id")
    .order("signal_date", { ascending: false })
    .returns<Array<{ id: string }>>();

  if (error) throw error;

  const results = [];
  for (const signal of data ?? []) {
    results.push({ signalEventId: signal.id, results: await runBacktestForSignal(signal.id) });
  }
  return results;
}

export async function runDailyBacktestUpdate(limit = 25) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("signal_events")
    .select("id")
    .order("signal_date", { ascending: false })
    .limit(limit)
    .returns<Array<{ id: string }>>();

  if (error) throw error;

  const results = [];
  for (const signal of data ?? []) {
    results.push({
      signalEventId: signal.id,
      results: await runBacktestForSignal(signal.id),
    });
  }
  return {
    signalCount: results.length,
    results,
  };
}

export function mapOutcomeRow(row: OutcomeRow) {
  return mapOutcome(row);
}
