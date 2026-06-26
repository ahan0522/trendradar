import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSignalReturnDetails } from "@/lib/signals/backtest";
import {
  derivedEvidenceItems,
  derivedLessons,
  derivedTimelineEvents,
  emptyStockReturnDetails,
  getDerivedSignalById,
  pendingOutcomes,
} from "@/lib/signals/derived-signals";

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

type EvidenceItemRow = {
  id: string;
  signal_event_id: string;
  evidence_date: string | null;
  source_name: string | null;
  source_url: string | null;
  source_type: string;
  title: string;
  summary: string | null;
  why_it_matters: string | null;
  known_at_signal_time: boolean;
};

type TimelineEventRow = {
  id: string;
  signal_event_id: string;
  event_date: string | null;
  event_type: string;
  title: string;
  description: string | null;
  source_url: string | null;
  known_at_signal_time: boolean;
  display_order: number;
};

type LessonRow = {
  id: string;
  signal_event_id: string;
  lesson_type: string;
  title: string;
  description: string | null;
  impact: string | null;
};

async function readCaseStudyParts(supabase: ReturnType<typeof getSupabaseAdmin>, id: string) {
  const [evidenceResult, timelineResult, lessonsResult] = await Promise.all([
    supabase
      .from("signal_evidence_items")
      .select("id, signal_event_id, evidence_date, source_name, source_url, source_type, title, summary, why_it_matters, known_at_signal_time")
      .eq("signal_event_id", id)
      .order("evidence_date", { ascending: true })
      .returns<EvidenceItemRow[]>(),
    supabase
      .from("signal_timeline_events")
      .select("id, signal_event_id, event_date, event_type, title, description, source_url, known_at_signal_time, display_order")
      .eq("signal_event_id", id)
      .order("display_order", { ascending: true })
      .returns<TimelineEventRow[]>(),
    supabase
      .from("signal_lessons")
      .select("id, signal_event_id, lesson_type, title, description, impact")
      .eq("signal_event_id", id)
      .order("created_at", { ascending: true })
      .returns<LessonRow[]>(),
  ]);

  return {
    evidenceItems: evidenceResult.error ? [] : evidenceResult.data ?? [],
    timelineEvents: timelineResult.error ? [] : timelineResult.data ?? [],
    lessons: lessonsResult.error ? [] : lessonsResult.data ?? [],
  };
}

function mapEvidenceItem(item: EvidenceItemRow) {
  return {
    id: item.id,
    signalEventId: item.signal_event_id,
    evidenceDate: item.evidence_date ?? undefined,
    sourceName: item.source_name ?? undefined,
    sourceUrl: item.source_url ?? undefined,
    sourceType: item.source_type,
    title: item.title,
    summary: item.summary ?? undefined,
    whyItMatters: item.why_it_matters ?? undefined,
    knownAtSignalTime: item.known_at_signal_time,
  };
}

function mapTimelineEvent(item: TimelineEventRow) {
  return {
    id: item.id,
    signalEventId: item.signal_event_id,
    eventDate: item.event_date ?? undefined,
    eventType: item.event_type,
    title: item.title,
    description: item.description ?? undefined,
    sourceUrl: item.source_url ?? undefined,
    knownAtSignalTime: item.known_at_signal_time,
    displayOrder: Number(item.display_order),
  };
}

function mapLesson(item: LessonRow) {
  return {
    id: item.id,
    signalEventId: item.signal_event_id,
    lessonType: item.lesson_type,
    title: item.title,
    description: item.description ?? undefined,
    impact: item.impact ?? undefined,
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
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
    if (!signal) throw new Error("Signal not found in signal tables");

    const horizons = [7, 14, 30, 60];
    const [stockReturnDetails, caseStudyParts] = await Promise.all([
      Promise.all(
      horizons.map(async (horizonDays) => {
        const result = await getSignalReturnDetails(id, horizonDays);
        return { horizonDays, details: result.details, basketReturn: result.basketReturn };
      }),
      ),
      readCaseStudyParts(supabase, id),
    ]);

    return NextResponse.json({
      ok: true,
      source: "signal_tables",
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
      evidenceItems: caseStudyParts.evidenceItems.map(mapEvidenceItem),
      timelineEvents: caseStudyParts.timelineEvents.map(mapTimelineEvent),
      lessons: caseStudyParts.lessons.map(mapLesson),
    });
  } catch (error) {
    try {
      const signal = await getDerivedSignalById(id);
      if (!signal) return NextResponse.json({ ok: false, error: "Signal not found" }, { status: 404 });

      return NextResponse.json({
        ok: true,
        source: "derived_topics",
        signal,
        watchlists: [],
        outcomes: pendingOutcomes(signal.id),
        stockReturnDetails: emptyStockReturnDetails(),
        evidenceItems: derivedEvidenceItems(signal),
        timelineEvents: derivedTimelineEvents(signal),
        lessons: derivedLessons(signal),
      });
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }
}

