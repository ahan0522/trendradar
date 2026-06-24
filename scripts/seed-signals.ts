import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { MarketCode, SignalType } from "@/types/signals";

loadEnvConfig(process.cwd());

type SeedWatchlist = {
  symbol: string;
  companyName: string;
  market: MarketCode;
};

type SeedSignal = {
  id: string;
  topic: string;
  signalDate: string;
  asOfDate: string;
  signalType: SignalType;
  signalStrength: number;
  confidenceScore: number;
  hypothesis: string;
  watchlist: SeedWatchlist[];
};

const seeds: SeedSignal[] = [
  {
    id: "seed-memory-price-dislocation",
    topic: "Memory Price Dislocation",
    signalDate: "2026-03-31",
    asOfDate: "2026-03-31",
    signalType: "price",
    signalStrength: 95,
    confidenceScore: 92,
    hypothesis:
      "AI server and HBM demand are reallocating memory production capacity, creating structural DRAM/NAND price pressure.",
    watchlist: [
      { symbol: "MU", companyName: "Micron", market: "US" },
      { symbol: "000660.KS", companyName: "SK Hynix", market: "KR" },
      { symbol: "005930.KS", companyName: "Samsung Electronics", market: "KR" },
      { symbol: "2408.TW", companyName: "南亞科", market: "TW" },
      { symbol: "2344.TW", companyName: "華邦電", market: "TW" },
      { symbol: "8299.TW", companyName: "群聯", market: "TW" },
    ],
  },
  {
    id: "seed-ai-power-infrastructure",
    topic: "AI Power Infrastructure",
    signalDate: "2026-04-16",
    asOfDate: "2026-04-16",
    signalType: "mixed",
    signalStrength: 89,
    confidenceScore: 86,
    hypothesis:
      "AI data center expansion is shifting the bottleneck from compute to power generation, grid equipment, transformers and data center power systems.",
    watchlist: [
      { symbol: "GEV", companyName: "GE Vernova", market: "US" },
      { symbol: "ETN", companyName: "Eaton", market: "US" },
      { symbol: "ABB", companyName: "ABB", market: "US" },
      { symbol: "2308.TW", companyName: "台達電", market: "TW" },
      { symbol: "1513.TW", companyName: "中興電", market: "TW" },
      { symbol: "1519.TW", companyName: "華城", market: "TW" },
    ],
  },
  {
    id: "seed-ai-cooling-infrastructure",
    topic: "AI Cooling Infrastructure",
    signalDate: "2026-05-31",
    asOfDate: "2026-05-31",
    signalType: "supply_chain",
    signalStrength: 84,
    confidenceScore: 80,
    hypothesis:
      "High-density AI servers are increasing rack-level thermal loads, accelerating demand for liquid cooling and advanced thermal management.",
    watchlist: [
      { symbol: "VRT", companyName: "Vertiv", market: "US" },
      { symbol: "3017.TW", companyName: "奇鋐", market: "TW" },
      { symbol: "3324.TW", companyName: "雙鴻", market: "TW" },
      { symbol: "2308.TW", companyName: "台達電", market: "TW" },
    ],
  },
];

function stableId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  const supabase = getSupabaseAdmin();
  const signalRows = seeds.map((seed) => ({
    id: seed.id,
    signal_date: seed.signalDate,
    as_of_date: seed.asOfDate,
    topic: seed.topic,
    signal_type: seed.signalType,
    signal_strength: seed.signalStrength,
    confidence_score: seed.confidenceScore,
    hypothesis: seed.hypothesis,
    evidence: [
      {
        source: "manual-seed",
        as_of_date: seed.asOfDate,
        note: "Seed signal for TrendRadar v2 validation flow.",
      },
    ],
    status: "active",
    model_version: "seed-v1",
    updated_at: new Date().toISOString(),
  }));

  const { error: signalError } = await supabase.from("signal_events").upsert(signalRows, { onConflict: "id" });
  if (signalError) throw signalError;

  const watchlistRows = seeds.flatMap((seed) => {
    const weight = Number((1 / seed.watchlist.length).toFixed(4));
    return seed.watchlist.map((item) => ({
      id: `${seed.id}-${stableId(item.symbol)}`,
      signal_event_id: seed.id,
      symbol: item.symbol,
      company_name: item.companyName,
      market: item.market,
      thesis: seed.hypothesis,
      weight,
      source: "manual-seed",
      updated_at: new Date().toISOString(),
    }));
  });

  const { error: watchlistError } = await supabase
    .from("signal_watchlists")
    .upsert(watchlistRows, { onConflict: "signal_event_id,symbol,market" });
  if (watchlistError) throw watchlistError;

  const outcomeRows = seeds.flatMap((seed) =>
    [7, 14, 30, 60].map((horizonDays) => ({
      signal_event_id: seed.id,
      horizon_days: horizonDays,
      basket_return: 0,
      benchmark_symbol: seed.watchlist.every((item) => item.market === "TW") ? "0050.TW" : "SPY",
      benchmark_market: seed.watchlist.every((item) => item.market === "TW") ? "TW" : "US",
      benchmark_return: 0,
      excess_return: 0,
      outcome: "pending",
      details: [],
      evaluated_at: new Date().toISOString(),
    })),
  );

  const { error: outcomeError } = await supabase
    .from("signal_outcomes")
    .upsert(outcomeRows, { onConflict: "signal_event_id,horizon_days" });
  if (outcomeError) throw outcomeError;

  console.log(`Seeded ${signalRows.length} signals, ${watchlistRows.length} watchlist rows, ${outcomeRows.length} pending outcomes.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
