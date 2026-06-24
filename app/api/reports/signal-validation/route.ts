import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getDerivedSignalsFromTopics, pendingOutcomes } from "@/lib/signals/derived-signals";

type SignalRow = {
  id: string;
  signal_date: string;
  as_of_date: string;
  topic: string;
  signal_type: string;
  signal_strength: number;
  confidence_score: number;
  hypothesis: string;
  status: string;
};

type WatchlistRow = {
  signal_event_id: string;
  symbol: string;
  company_name: string;
  market: string;
  weight: number;
};

type OutcomeRow = {
  signal_event_id: string;
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: string;
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function reportPayload(signals: SignalRow[], watchlists: WatchlistRow[], outcomes: OutcomeRow[], source: string) {
  const validated = outcomes.filter((row) => row.outcome !== "pending");
  const successRate = validated.length === 0 ? 0 : (validated.filter((row) => row.outcome === "success").length / validated.length) * 100;
  const averageBasketReturn = average(validated.map((row) => Number(row.basket_return)));
  const averageExcessReturn = average(validated.map((row) => Number(row.excess_return)));

  return {
    ok: true,
    source,
    summary: {
      title: "TrendRadar Signal Validation Report",
      period: "March-June 2026",
      subtitle: "AI-Native Market Signal Engine",
      signalCount: signals.length,
      validatedOutcomeCount: validated.length,
      successRate,
      averageBasketReturn,
      averageExcessReturn,
    },
    signals,
    watchlists,
    outcomes,
    successRate,
    averageBasketReturn,
    averageExcessReturn,
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: signals, error: signalError }, { data: watchlists, error: watchlistError }, { data: outcomes, error: outcomeError }] =
      await Promise.all([
        supabase
          .from("signal_events")
          .select("id, signal_date, as_of_date, topic, signal_type, signal_strength, confidence_score, hypothesis, status")
          .order("signal_date", { ascending: true })
          .returns<SignalRow[]>(),
        supabase
          .from("signal_watchlists")
          .select("signal_event_id, symbol, company_name, market, weight")
          .order("symbol", { ascending: true })
          .returns<WatchlistRow[]>(),
        supabase
          .from("signal_outcomes")
          .select("signal_event_id, horizon_days, basket_return, benchmark_return, excess_return, outcome")
          .order("horizon_days", { ascending: true })
          .returns<OutcomeRow[]>(),
      ]);

    if (signalError) throw signalError;
    if (watchlistError) throw watchlistError;
    if (outcomeError) throw outcomeError;

    return NextResponse.json(reportPayload(signals ?? [], watchlists ?? [], outcomes ?? [], "signal_tables"));
  } catch (error) {
    try {
      const derivedSignals = await getDerivedSignalsFromTopics();
      const signals = derivedSignals.map((signal) => ({
        id: signal.id,
        signal_date: signal.signalDate,
        as_of_date: signal.asOfDate,
        topic: signal.topic,
        signal_type: signal.signalType,
        signal_strength: signal.signalStrength,
        confidence_score: signal.confidenceScore,
        hypothesis: signal.hypothesis,
        status: signal.status,
      }));
      const outcomes = derivedSignals.flatMap((signal) => pendingOutcomes(signal.id));
      return NextResponse.json(reportPayload(signals, [], outcomes, "derived_topics"));
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ ok: false, error: message, summary: null, signals: [], watchlists: [], outcomes: [] }, { status: 200 });
    }
  }
}
