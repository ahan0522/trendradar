import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getDerivedSignalsFromTopics } from "@/lib/signals/derived-signals";
import { getCurrentMonthlySignals } from "@/lib/signals/monthly-signals";
import { publishableLatestPrice } from "@/lib/signals/price-quality";

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

type WatchlistRow = {
  signal_event_id: string;
  symbol: string;
  company_name: string;
  market: string;
  thesis: string;
  weight: number;
  source: string | null;
  value_chain_role?: string | null;
  causal_reason?: string | null;
  tracking_metrics?: string[] | null;
  invalidation_conditions?: string[] | null;
  direct_operating_link?: boolean | null;
};

type PriceRow = {
  symbol: string;
  market: string;
  price_date: string;
  close: number;
  adj_close: number | null;
  volume: number | null;
  quality_status: string | null;
  provider: string | null;
  source_url: string | null;
};

function priceKey(symbol: string, market: string) {
  return `${symbol}::${market}`;
}

const watchlistBaseSelect = "signal_event_id, symbol, company_name, market, thesis, weight, source";
const watchlistResearchSelect = `${watchlistBaseSelect}, value_chain_role, causal_reason, tracking_metrics, invalidation_conditions, direct_operating_link`;

function isMissingWatchlistResearchColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
  return /value_chain_role|causal_reason|tracking_metrics|invalidation_conditions|direct_operating_link|schema cache|column/i.test(message);
}

async function readSignalWatchlists(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const result = await supabase
    .from("signal_watchlists")
    .select(watchlistResearchSelect)
    .order("weight", { ascending: false })
    .returns<WatchlistRow[]>();

  if (!result.error || !isMissingWatchlistResearchColumns(result.error)) return result;

  return supabase
    .from("signal_watchlists")
    .select(watchlistBaseSelect)
    .order("weight", { ascending: false })
    .returns<WatchlistRow[]>();
}

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
        readSignalWatchlists(supabase),
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

    const symbols = [...new Set((watchlists ?? []).map((item) => item.symbol))];
    const markets = [...new Set((watchlists ?? []).map((item) => item.market))];
    const { data: prices, error: pricesError } =
      symbols.length > 0
        ? await supabase
            .from("stock_prices")
            .select("symbol, market, price_date, close, adj_close, volume, quality_status, provider, source_url")
            .in("symbol", symbols)
            .in("market", markets)
            .eq("quality_status", "verified")
            .order("price_date", { ascending: false })
            .limit(5000)
            .returns<PriceRow[]>()
        : { data: [] as PriceRow[], error: null };

    if (pricesError) throw pricesError;

    const latestPrices = new Map<string, PriceRow>();
    for (const price of prices ?? []) {
      const key = priceKey(price.symbol, price.market);
      if (!latestPrices.has(key)) latestPrices.set(key, price);
    }

    const watchlistsBySignal = new Map<string, WatchlistRow[]>();
    for (const item of watchlists ?? []) {
      watchlistsBySignal.set(item.signal_event_id, [...(watchlistsBySignal.get(item.signal_event_id) ?? []), item]);
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
        watchlistCount: watchlistsBySignal.get(signal.id)?.length ?? 0,
        watchlists: (watchlistsBySignal.get(signal.id) ?? []).map((item) => {
          const latestPrice = latestPrices.get(priceKey(item.symbol, item.market));
          const rawLatestPrice = latestPrice
            ? {
                priceDate: latestPrice.price_date,
                close: Number(latestPrice.close),
                adjClose: latestPrice.adj_close === null ? null : Number(latestPrice.adj_close),
                volume: latestPrice.volume === null ? null : Number(latestPrice.volume),
                qualityStatus: latestPrice.quality_status,
                provider: latestPrice.provider,
                sourceUrl: latestPrice.source_url,
              }
            : null;
          const publishable = publishableLatestPrice(item.symbol, item.market, rawLatestPrice);
          return {
            symbol: item.symbol,
            companyName: item.company_name,
            market: item.market,
            thesis: item.thesis,
            weight: Number(item.weight),
            source: item.source,
            valueChainRole: item.value_chain_role ?? undefined,
            causalReason: item.causal_reason ?? undefined,
            trackingMetrics: item.tracking_metrics ?? [],
            invalidationConditions: item.invalidation_conditions ?? [],
            directOperatingLink: item.direct_operating_link ?? false,
            latestPrice: publishable.latestPrice,
            priceQuality: publishable.priceQuality,
          };
        }),
        latestOutcome: outcomesBySignal.get(signal.id)?.[0] ?? null,
        bestOutcome: [...(outcomesBySignal.get(signal.id) ?? [])].sort((a, b) => Number(b.excess_return) - Number(a.excess_return))[0] ?? null,
      })),
    });
  } catch (error) {
    try {
      const monthlySignals = await getCurrentMonthlySignals();
      if (monthlySignals.length > 0) {
        return NextResponse.json({ ok: true, source: "monthly_current", signals: monthlySignals });
      }

      const signals = await getDerivedSignalsFromTopics();
      return NextResponse.json({ ok: true, source: "derived_topics", signals });
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ ok: false, error: message, signals: [] }, { status: 200 });
    }
  }
}

