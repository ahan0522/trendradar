import {
  CURRENT_BACKTEST_MODEL_VERSIONS,
  isHorizonMature,
  outcomeMatchesWatchlist,
  SIGNAL_BACKTEST_HORIZONS,
} from "@/lib/signals/backtest";
import { getSupabaseAdmin } from "@/lib/supabase-server";

type StrictSignalRow = {
  id: string;
  signal_date: string;
  topic: string;
  model_version: string | null;
};

type StrictWatchlistRow = {
  signal_event_id: string;
  symbol: string;
  market: string;
};

type StrictOutcomeRow = {
  signal_event_id: string;
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: "success" | "partial" | "failed" | "pending";
  details: unknown;
  evaluated_at: string | null;
};

type StrictPerformanceInput = {
  signals: StrictSignalRow[];
  watchlists: StrictWatchlistRow[];
  outcomes: StrictOutcomeRow[];
  asOfDate: string;
};

function average(values: number[]) {
  return values.length === 0
    ? null
    : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export function buildStrictPerformanceStatistics(input: StrictPerformanceInput) {
  const signals = input.signals.filter((signal) =>
    CURRENT_BACKTEST_MODEL_VERSIONS.includes(
      signal.model_version as (typeof CURRENT_BACKTEST_MODEL_VERSIONS)[number],
    )
  );
  const watchlistsBySignal = new Map<string, StrictWatchlistRow[]>();
  for (const item of input.watchlists) {
    const rows = watchlistsBySignal.get(item.signal_event_id) ?? [];
    rows.push(item);
    watchlistsBySignal.set(item.signal_event_id, rows);
  }
  const outcomesByKey = new Map(
    input.outcomes.map((item) => [`${item.signal_event_id}:${item.horizon_days}`, item]),
  );
  const failureReasons = {
    notMature: 0,
    noMapping: 0,
    missingOutcome: 0,
    staleBasket: 0,
    missingPrices: 0,
    negativeAlpha: 0,
  };
  const validOutcomes: Array<StrictOutcomeRow & { signalId: string }> = [];
  const firstValidationDays: number[] = [];

  const horizons = SIGNAL_BACKTEST_HORIZONS.map((horizonDays) => {
    const rows: Array<StrictOutcomeRow & { signalId: string }> = [];
    let matureSignalCount = 0;
    let mappedMatureSignalCount = 0;
    for (const signal of signals) {
      if (!isHorizonMature(signal.signal_date, horizonDays, input.asOfDate)) {
        failureReasons.notMature += 1;
        continue;
      }
      matureSignalCount += 1;
      const watchlists = watchlistsBySignal.get(signal.id) ?? [];
      if (watchlists.length === 0) {
        failureReasons.noMapping += 1;
        continue;
      }
      mappedMatureSignalCount += 1;
      const outcome = outcomesByKey.get(`${signal.id}:${horizonDays}`);
      if (!outcome) {
        failureReasons.missingOutcome += 1;
        continue;
      }
      if (!outcomeMatchesWatchlist(outcome.details, watchlists)) {
        failureReasons.staleBasket += 1;
        continue;
      }
      if (outcome.outcome === "pending") {
        failureReasons.missingPrices += 1;
        continue;
      }
      const row = { ...outcome, signalId: signal.id };
      rows.push(row);
      validOutcomes.push(row);
      if (outcome.excess_return < 0) failureReasons.negativeAlpha += 1;
    }
    return {
      horizonDays,
      strictSignalCount: signals.length,
      matureSignalCount,
      mappedMatureSignalCount,
      validSampleCount: rows.length,
      successCount: rows.filter((item) => item.outcome === "success").length,
      partialCount: rows.filter((item) => item.outcome === "partial").length,
      failedCount: rows.filter((item) => item.outcome === "failed").length,
      successRate: rows.length === 0
        ? null
        : Number((rows.filter((item) => item.outcome === "success").length / rows.length).toFixed(3)),
      averageBasketReturn: average(rows.map((item) => Number(item.basket_return))),
      averageBenchmarkReturn: average(rows.map((item) => Number(item.benchmark_return))),
      averageAlpha: average(rows.map((item) => Number(item.excess_return))),
    };
  });

  for (const signal of signals) {
    const first = validOutcomes
      .filter((item) => item.signalId === signal.id)
      .sort((a, b) => a.horizon_days - b.horizon_days)[0];
    if (first) firstValidationDays.push(first.horizon_days);
  }

  return {
    generatedAt: new Date().toISOString(),
    asOfDate: input.asOfDate,
    modelVersions: [...CURRENT_BACKTEST_MODEL_VERSIONS],
    strictSignalCount: signals.length,
    mappedSignalCount: signals.filter((signal) =>
      (watchlistsBySignal.get(signal.id)?.length ?? 0) > 0
    ).length,
    validOutcomeCount: validOutcomes.length,
    validSignalCount: new Set(validOutcomes.map((item) => item.signalId)).size,
    firstValidationLeadDays: {
      available: firstValidationDays.length > 0,
      sampleCount: firstValidationDays.length,
      averageDays: average(firstValidationDays),
      definition: "Signal date to earliest completed valid horizon.",
    },
    marketConsensusLeadDays: {
      available: false,
      sampleCount: 0,
      averageDays: null,
      reason: "A versioned market-consensus event is not yet stored; no lead-time claim is made.",
    },
    failureReasons: {
      unit: "signal-horizon",
      ...failureReasons,
    },
    horizons,
    sampleStatus: validOutcomes.length === 0 ? "insufficient_data" : "observational",
    caveat: "Only current-model outcomes whose stored basket matches the current beneficiary basket are counted.",
  };
}

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function getStrictPerformanceStatistics(asOfDate = currentTaipeiDate()) {
  const supabase = getSupabaseAdmin();
  const [{ data: signals, error: signalError }, { data: watchlists, error: watchlistError }, { data: outcomes, error: outcomeError }] =
    await Promise.all([
      supabase
        .from("signal_events")
        .select("id, signal_date, topic, model_version")
        .in("model_version", [...CURRENT_BACKTEST_MODEL_VERSIONS])
        .returns<StrictSignalRow[]>(),
      supabase
        .from("signal_watchlists")
        .select("signal_event_id, symbol, market")
        .returns<StrictWatchlistRow[]>(),
      supabase
        .from("signal_outcomes")
        .select("signal_event_id, horizon_days, basket_return, benchmark_return, excess_return, outcome, details, evaluated_at")
        .returns<StrictOutcomeRow[]>(),
    ]);
  if (signalError) throw signalError;
  if (watchlistError) throw watchlistError;
  if (outcomeError) throw outcomeError;
  return buildStrictPerformanceStatistics({
    signals: signals ?? [],
    watchlists: watchlists ?? [],
    outcomes: outcomes ?? [],
    asOfDate,
  });
}
