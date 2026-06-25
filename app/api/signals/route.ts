import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getDerivedSignalsFromTopics } from "@/lib/signals/derived-signals";

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
  model_version: string | null;
};

type OutcomeRow = {
  signal_event_id: string;
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: string;
};

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: signals, error: signalsError }, { data: watchlists, error: watchlistsError }, { data: outcomes, error: outcomesError }] =
      await Promise.all([
        supabase
          .from("signal_events")
          .select("id, signal_date, as_of_date, topic, signal_type, signal_strength, confidence_score, hypothesis, status, model_version")
          .order("signal_date", { ascending: false })
          .returns<SignalRow[]>(),
        supabase.from("signal_watchlists").select("signal_event_id").returns<Array<{ signal_event_id: string }>>(),
        supabase
          .from("signal_outcomes")
          .select("signal_event_id, horizon_days, basket_return, benchmark_return, excess_return, outcome")
          .order("horizon_days", { ascending: false })
          .returns<OutcomeRow[]>(),
      ]);

    if (signalsError) throw signalsError;
    if (watchlistsError) throw watchlistsError;
    if (outcomesError) throw outcomesError;
    if ((signals ?? []).length === 0) throw new Error("No signal table rows yet");

    const watchlistCounts = new Map<string, number>();
    for (const item of watchlists ?? []) {
      watchlistCounts.set(item.signal_event_id, (watchlistCounts.get(item.signal_event_id) ?? 0) + 1);
    }

    const outcomesBySignal = new Map<string, OutcomeRow[]>();
    for (const outcome of outcomes ?? []) {
      outcomesBySignal.set(outcome.signal_event_id, [...(outcomesBySignal.get(outcome.signal_event_id) ?? []), outcome]);
    }

    return NextResponse.json({
      ok: true,
      source: "signal_tables",
      signals: (signals ?? []).map((signal) => ({
        id: signal.id,
        signalDate: signal.signal_date,
        asOfDate: signal.as_of_date,
        topic: signal.topic,
        signalType: signal.signal_type,
        signalStrength: Number(signal.signal_strength),
        confidenceScore: Number(signal.confidence_score),
        hypothesis: signal.hypothesis,
        status: signal.status,
        modelVersion: signal.model_version,
        watchlistCount: watchlistCounts.get(signal.id) ?? 0,
        latestOutcome: outcomesBySignal.get(signal.id)?.[0] ?? null,
        bestOutcome: [...(outcomesBySignal.get(signal.id) ?? [])].sort((a, b) => Number(b.excess_return) - Number(a.excess_return))[0] ?? null,
      })),
    });
  } catch (error) {
    try {
      const signals = await getDerivedSignalsFromTopics();
      return NextResponse.json({ ok: true, source: "derived_topics", signals });
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ ok: false, error: message, signals: [] }, { status: 200 });
    }
  }
}

