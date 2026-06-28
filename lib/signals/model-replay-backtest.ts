import { addDays, isValidBacktestWindow } from "@/lib/signals/backtest";
import { mapBeneficiaries } from "@/lib/signals/beneficiary-mapping";
import { getLatestModelReplay, type ReplaySignal } from "@/lib/signals/model-replay";
import { calculateReturn, getPriceOnOrAfter, getPriceOnOrBefore } from "@/lib/signals/stock-prices";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { MarketCode, SignalWatchlistItem } from "@/types/signals";

export type ReplayStockReturn = {
  symbol: string;
  companyName: string;
  market: MarketCode;
  weight: number;
  entryDate: string | null;
  entryPrice: number | null;
  exitDate: string | null;
  exitPrice: number | null;
  returnPct: number | null;
};

export type ReplayBacktestOutcome = {
  horizonDays: number;
  basketReturn: number | null;
  benchmarkSymbol: string;
  benchmarkMarket: MarketCode;
  benchmarkReturn: number | null;
  excessReturn: number | null;
  outcome: "success" | "partial" | "failed" | "pending";
  details: ReplayStockReturn[];
};

export type ReplaySignalResult = {
  runId: string;
  signalId: string;
  month: string;
  signalDate: string;
  topic: string;
  family: string;
  modelVersion: string;
  mappingStatus: "tested" | "unmapped" | "missing_prices" | "pending_horizon";
  watchlist: SignalWatchlistItem[];
  outcomes: ReplayBacktestOutcome[];
  missingPrices: string[];
};

type ReplayResultRow = {
  run_id: string;
  signal_id: string;
  month: string;
  signal_date: string;
  topic: string;
  family: string;
  model_version: string;
  mapping_status: ReplaySignalResult["mappingStatus"];
  watchlist: SignalWatchlistItem[];
  outcomes: ReplayBacktestOutcome[];
  missing_prices: string[];
};

function normalizeWeights(items: SignalWatchlistItem[]) {
  const total = items.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  if (total <= 0) return items.map(() => 1 / Math.max(items.length, 1));
  return items.map((item) => Number(item.weight || 0) / total);
}

function benchmarkFor(markets: MarketCode[]) {
  if (markets.length > 0 && markets.every((market) => market === "TW")) {
    return { symbol: "0050.TW", market: "TW" as MarketCode };
  }
  return { symbol: "SPY", market: "US" as MarketCode };
}

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isReplayHorizonMature(
  signalDate: string,
  horizonDays: number,
  asOfDate = currentTaipeiDate(),
) {
  return addDays(signalDate, horizonDays) < asOfDate;
}

async function evaluateReplayOutcome(
  signalDate: string,
  watchlist: SignalWatchlistItem[],
  horizonDays: number,
): Promise<ReplayBacktestOutcome> {
  const targetDate = addDays(signalDate, horizonDays);
  const benchmark = benchmarkFor(watchlist.map((item) => item.market));
  const weights = normalizeWeights(watchlist);

  if (!isReplayHorizonMature(signalDate, horizonDays)) {
    return {
      horizonDays,
      basketReturn: null,
      benchmarkSymbol: benchmark.symbol,
      benchmarkMarket: benchmark.market,
      benchmarkReturn: null,
      excessReturn: null,
      outcome: "pending",
      details: [],
    };
  }

  const details = await Promise.all(watchlist.map(async (item, index): Promise<ReplayStockReturn> => {
    const entry = await getPriceOnOrAfter(item.symbol, item.market, signalDate, targetDate);
    const exit = await getPriceOnOrBefore(item.symbol, item.market, targetDate, entry?.priceDate ?? signalDate);
    const entryPrice = entry?.adjClose ?? entry?.close ?? null;
    const exitPrice = exit?.adjClose ?? exit?.close ?? null;
    const valid = isValidBacktestWindow(
      signalDate,
      targetDate,
      entry?.priceDate ?? null,
      exit?.priceDate ?? null,
    );
    return {
      symbol: item.symbol,
      companyName: item.companyName,
      market: item.market,
      weight: weights[index],
      entryDate: entry?.priceDate ?? null,
      entryPrice,
      exitDate: exit?.priceDate ?? null,
      exitPrice,
      returnPct: valid && entryPrice !== null && exitPrice !== null
        ? calculateReturn(entryPrice, exitPrice)
        : null,
    };
  }));

  const benchmarkEntry = await getPriceOnOrAfter(benchmark.symbol, benchmark.market, signalDate, targetDate);
  const benchmarkExit = await getPriceOnOrBefore(
    benchmark.symbol,
    benchmark.market,
    targetDate,
    benchmarkEntry?.priceDate ?? signalDate,
  );
  const benchmarkEntryPrice = benchmarkEntry?.adjClose ?? benchmarkEntry?.close ?? null;
  const benchmarkExitPrice = benchmarkExit?.adjClose ?? benchmarkExit?.close ?? null;
  const benchmarkValid = isValidBacktestWindow(
    signalDate,
    targetDate,
    benchmarkEntry?.priceDate ?? null,
    benchmarkExit?.priceDate ?? null,
  );
  const benchmarkReturn = benchmarkValid && benchmarkEntryPrice !== null && benchmarkExitPrice !== null
    ? calculateReturn(benchmarkEntryPrice, benchmarkExitPrice)
    : null;

  if (details.some((item) => item.returnPct === null) || benchmarkReturn === null) {
    return {
      horizonDays,
      basketReturn: null,
      benchmarkSymbol: benchmark.symbol,
      benchmarkMarket: benchmark.market,
      benchmarkReturn,
      excessReturn: null,
      outcome: "pending",
      details,
    };
  }

  const basketReturn = details.reduce((sum, item) => sum + Number(item.returnPct) * item.weight, 0);
  const excessReturn = basketReturn - benchmarkReturn;
  return {
    horizonDays,
    basketReturn,
    benchmarkSymbol: benchmark.symbol,
    benchmarkMarket: benchmark.market,
    benchmarkReturn,
    excessReturn,
    outcome: excessReturn >= 5 ? "success" : excessReturn >= 0 ? "partial" : "failed",
    details,
  };
}

export async function evaluateReplaySignal(input: {
  runId: string;
  month: string;
  asOfDate: string;
  signal: ReplaySignal;
  horizons?: number[];
}): Promise<ReplaySignalResult> {
  const watchlist = mapBeneficiaries({
    topic: `${input.signal.topic} ${input.signal.family} ${input.signal.category}`,
    signalEventId: input.signal.id,
  });

  if (watchlist.length === 0) {
    return {
      runId: input.runId,
      signalId: input.signal.id,
      month: input.month,
      signalDate: input.asOfDate,
      topic: input.signal.topic,
      family: input.signal.family,
      modelVersion: input.signal.modelVersion,
      mappingStatus: "unmapped",
      watchlist: [],
      outcomes: [],
      missingPrices: [],
    };
  }

  const outcomes: ReplayBacktestOutcome[] = [];
  for (const horizonDays of input.horizons ?? [30, 60, 90]) {
    outcomes.push(await evaluateReplayOutcome(input.asOfDate, watchlist, horizonDays));
  }
  const matureOutcomes = outcomes.filter((outcome) => isReplayHorizonMature(input.asOfDate, outcome.horizonDays));
  const missingPrices = [...new Set(matureOutcomes.flatMap((outcome) => [
    ...outcome.details.filter((item) => item.returnPct === null).map((item) => item.symbol),
    ...(outcome.benchmarkReturn === null ? [outcome.benchmarkSymbol] : []),
  ]))];
  const mappingStatus = matureOutcomes.length === 0
    ? "pending_horizon"
    : missingPrices.length > 0
      ? "missing_prices"
      : "tested";

  return {
    runId: input.runId,
    signalId: input.signal.id,
    month: input.month,
    signalDate: input.asOfDate,
    topic: input.signal.topic,
    family: input.signal.family,
    modelVersion: input.signal.modelVersion,
    mappingStatus,
    watchlist,
    outcomes,
    missingPrices,
  };
}

async function upsertReplayResult(result: ReplaySignalResult) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("model_replay_signal_results").upsert({
    run_id: result.runId,
    signal_id: result.signalId,
    month: result.month,
    signal_date: result.signalDate,
    topic: result.topic,
    family: result.family,
    model_version: result.modelVersion,
    mapping_status: result.mappingStatus,
    watchlist: result.watchlist,
    outcomes: result.outcomes,
    missing_prices: result.missingPrices,
    updated_at: new Date().toISOString(),
  }, { onConflict: "run_id,model_version,signal_id" });
  if (error) throw error;
}

function summarize(results: ReplaySignalResult[]) {
  const thirtyDay = results
    .flatMap((result) => result.outcomes.map((outcome) => ({ ...outcome, modelVersion: result.modelVersion })))
    .filter((outcome) => outcome.horizonDays === 30 && outcome.excessReturn !== null);
  const average = (values: number[]) => values.length === 0
    ? null
    : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
  const modelStats = (modelVersion: string) => {
    const rows = results.filter((item) => item.modelVersion === modelVersion);
    const outcomes = thirtyDay.filter((item) => item.modelVersion === modelVersion);
    return {
      signalCount: rows.length,
      mappedCount: rows.filter((item) => item.watchlist.length > 0).length,
      testedCount: outcomes.length,
      averageThirtyDayExcessReturn: average(outcomes.map((item) => Number(item.excessReturn))),
      thirtyDaySuccessRate: outcomes.length === 0
        ? null
        : Number((outcomes.filter((item) => item.outcome === "success").length / outcomes.length).toFixed(3)),
    };
  };

  return {
    signalCount: results.length,
    mappedCount: results.filter((item) => item.watchlist.length > 0).length,
    testedCount: results.filter((item) => item.mappingStatus === "tested").length,
    unmappedCount: results.filter((item) => item.mappingStatus === "unmapped").length,
    missingPriceCount: results.filter((item) => item.mappingStatus === "missing_prices").length,
    pendingHorizonCount: results.filter((item) => item.mappingStatus === "pending_horizon").length,
    thirtyDayTestCount: thirtyDay.length,
    averageThirtyDayExcessReturn: average(thirtyDay.map((item) => Number(item.excessReturn))),
    thirtyDaySuccessRate: thirtyDay.length === 0
      ? null
      : Number((thirtyDay.filter((item) => item.outcome === "success").length / thirtyDay.length).toFixed(3)),
    baseline: modelStats("monthly-signal-v2"),
    candidate: modelStats("monthly-full-market-v1"),
  };
}

export async function runModelReplayBacktest(runId?: string) {
  const replay = await getLatestModelReplay(runId);
  if (!replay) throw new Error("Model replay run not found");

  const results: ReplaySignalResult[] = [];
  for (const month of replay.months) {
    for (const signal of [...month.baselineSignals, ...month.candidateSignals]) {
      const result = await evaluateReplaySignal({
        runId: replay.id,
        month: month.month,
        asOfDate: month.asOfDate,
        signal,
      });
      await upsertReplayResult(result);
      results.push(result);
    }
  }

  return { runId: replay.id, summary: summarize(results), results };
}

export async function runModelReplayBacktestForSymbols(runId: string, symbols: string[]) {
  const replay = await getLatestModelReplay(runId);
  if (!replay) throw new Error("Model replay run not found");
  const existing = await getModelReplayBacktestResults(replay.id);
  const symbolSet = new Set(symbols.map((symbol) => symbol.toUpperCase()));
  const affectedKeys = new Set(
    existing.results
      .filter((result) => result.missingPrices.some((symbol) => symbolSet.has(symbol.toUpperCase())))
      .map((result) => `${result.modelVersion}|${result.signalId}`),
  );

  let updatedCount = 0;
  for (const month of replay.months) {
    for (const signal of [...month.baselineSignals, ...month.candidateSignals]) {
      if (!affectedKeys.has(`${signal.modelVersion}|${signal.id}`)) continue;
      const result = await evaluateReplaySignal({
        runId: replay.id,
        month: month.month,
        asOfDate: month.asOfDate,
        signal,
      });
      await upsertReplayResult(result);
      updatedCount += 1;
    }
  }

  const refreshed = await getModelReplayBacktestResults(replay.id);
  return {
    runId: replay.id,
    symbols: [...symbolSet],
    affectedCount: affectedKeys.size,
    updatedCount,
    summary: refreshed.summary,
  };
}

export async function getModelReplayBacktestResults(runId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("model_replay_signal_results")
    .select("run_id, signal_id, month, signal_date, topic, family, model_version, mapping_status, watchlist, outcomes, missing_prices")
    .eq("run_id", runId)
    .order("month", { ascending: true })
    .returns<ReplayResultRow[]>();
  if (error?.code === "42P01") return { summary: summarize([]), results: [] };
  if (error) throw error;

  const results = (data ?? []).map((row): ReplaySignalResult => ({
    runId: row.run_id,
    signalId: row.signal_id,
    month: row.month,
    signalDate: row.signal_date,
    topic: row.topic,
    family: row.family,
    modelVersion: row.model_version,
    mappingStatus: row.mapping_status,
    watchlist: row.watchlist,
    outcomes: row.outcomes,
    missingPrices: row.missing_prices,
  }));
  return { summary: summarize(results), results };
}
