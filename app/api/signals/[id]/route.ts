import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSignalReturnDetails } from "@/lib/signals/backtest";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SignalRow = {
  id: string;
  signal_date: string;
  as_of_date: string;
  topic: string;
  signal_type: string;
  signal_strength: number;
  confidence_score: number;
  hypothesis: string;
  evidence: unknown[];
  status: string;
  model_version: string | null;
};

type WatchlistRow = {
  id: string;
  signal_event_id: string;
  symbol: string;
  company_name: string;
  market: string;
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
  outcome: string;
  details: unknown[];
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const [{ data: signalRows, error: signalError }, { data: watchlists, error: watchlistError }, { data: outcomes, error: outcomeError }] =
      await Promise.all([
        supabase
          .from("signal_events")
          .select("id, signal_date, as_of_date, topic, signal_type, signal_strength, confidence_score, hypothesis, evidence, status, model_version")
          .eq("id", id)
          .limit(1)
          .returns<SignalRow[]>(),
        supabase
          .from("signal_watchlists")
          .select("id, signal_event_id, symbol, company_name, market, thesis, weight, source")
          .eq("signal_event_id", id)
          .order("weight", { ascending: false })
          .returns<WatchlistRow[]>(),
        supabase
          .from("signal_outcomes")
          .select("signal_event_id, horizon_days, basket_return, benchmark_return, excess_return, outcome, details")
          .eq("signal_event_id", id)
          .order("horizon_days", { ascending: true })
          .returns<OutcomeRow[]>(),
      ]);

    if (signalError) throw signalError;
    if (watchlistError) throw watchlistError;
    if (outcomeError) throw outcomeError;

    const signal = signalRows?.[0];
    if (!signal) return NextResponse.json({ ok: false, error: "Signal not found" }, { status: 404 });

    const horizons = [7, 14, 30, 60];
    const stockReturnDetails = await Promise.all(
      horizons.map(async (horizonDays) => {
        const result = await getSignalReturnDetails(id, horizonDays);
        return { horizonDays, details: result.details, basketReturn: result.basketReturn };
      }),
    );

    return NextResponse.json({
      ok: true,
      signal: {
        id: signal.id,
        signalDate: signal.signal_date,
        asOfDate: signal.as_of_date,
        topic: signal.topic,
        signalType: signal.signal_type,
        signalStrength: Number(signal.signal_strength),
        confidenceScore: Number(signal.confidence_score),
        hypothesis: signal.hypothesis,
        evidence: signal.evidence,
        status: signal.status,
        modelVersion: signal.model_version,
      },
      watchlists: (watchlists ?? []).map((item) => ({
        id: item.id,
        signalEventId: item.signal_event_id,
        symbol: item.symbol,
        companyName: item.company_name,
        market: item.market,
        thesis: item.thesis,
        weight: Number(item.weight),
        source: item.source,
      })),
      outcomes: outcomes ?? [],
      stockReturnDetails,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
