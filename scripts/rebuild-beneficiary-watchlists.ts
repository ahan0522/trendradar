import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { mapBeneficiaries } from "@/lib/signals/beneficiary-mapping";

loadEnvConfig(process.cwd());

type SignalRow = {
  id: string;
  topic: string;
  hypothesis: string | null;
};

type ExistingWatchlistRow = {
  signal_event_id: string;
  symbol: string;
  market: string;
  source: string | null;
  mapping_version: string | null;
};

function isMissingResearchColumn(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : String((error as { message?: unknown })?.message ?? error);
  return /value_chain_role|causal_reason|tracking_metrics|invalidation_conditions|direct_operating_link|mapping_version|mapping_sources|schema cache|column/i.test(message);
}

async function main() {
  const write = process.argv.includes("--write");
  const supabase = getSupabaseAdmin();
  const { data: signals, error: signalError } = await supabase
    .from("signal_events")
    .select("id, topic, hypothesis")
    .order("signal_date", { ascending: true })
    .returns<SignalRow[]>();
  if (signalError) throw signalError;

  const signalIds = (signals ?? []).map((signal) => signal.id);
  const { data: existing, error: existingError } = signalIds.length > 0
    ? await supabase
        .from("signal_watchlists")
        .select("signal_event_id, symbol, market, source, mapping_version")
        .in("signal_event_id", signalIds)
        .in("source", ["rule-based", "monthly-rule-based"])
        .returns<ExistingWatchlistRow[]>()
    : { data: [] as ExistingWatchlistRow[], error: null };
  if (existingError) throw existingError;

  const mapped = (signals ?? []).map((signal) => ({
    signal,
    items: mapBeneficiaries({
      topic: signal.topic,
      hypothesis: signal.hypothesis ?? undefined,
      signalEventId: signal.id,
    }),
  }));
  const watchlists = mapped.flatMap((entry) => entry.items);
  const plannedKeys = new Set(
    watchlists.map((item) => `${item.signalEventId}|${item.market}|${item.symbol}`),
  );
  const staleRows = (existing ?? []).filter(
    (item) => !plannedKeys.has(`${item.signal_event_id}|${item.market}|${item.symbol}`),
  );

  if (write && signalIds.length > 0) {
    const { error: cleanupError } = await supabase
      .from("signal_watchlists")
      .delete()
      .in("signal_event_id", signalIds)
      .in("source", ["rule-based", "monthly-rule-based"]);
    if (cleanupError) throw cleanupError;

    if (watchlists.length > 0) {
      const researchRows = watchlists.map((item) => ({
          id: item.id,
          signal_event_id: item.signalEventId,
          symbol: item.symbol,
          company_name: item.companyName,
          market: item.market,
          thesis: item.thesis,
          weight: item.weight,
          source: item.source ?? "rule-based",
          value_chain_role: item.valueChainRole,
          causal_reason: item.causalReason,
          tracking_metrics: item.trackingMetrics ?? [],
          invalidation_conditions: item.invalidationConditions ?? [],
          direct_operating_link: item.directOperatingLink ?? false,
          mapping_version: item.mappingVersion,
          mapping_sources: item.mappingSources ?? [],
          updated_at: new Date().toISOString(),
        }));
      const { error: writeError } = await supabase.from("signal_watchlists").upsert(
        researchRows,
        { onConflict: "signal_event_id,symbol,market" },
      );
      if (writeError) {
        if (!isMissingResearchColumn(writeError)) throw writeError;
        const legacyRows = researchRows.map((item) => {
          const {
            value_chain_role: _valueChainRole,
            causal_reason: _causalReason,
            tracking_metrics: _trackingMetrics,
            invalidation_conditions: _invalidationConditions,
            direct_operating_link: _directOperatingLink,
            mapping_version: _mappingVersion,
            mapping_sources: _mappingSources,
            ...legacy
          } = item;
          void _valueChainRole;
          void _causalReason;
          void _trackingMetrics;
          void _invalidationConditions;
          void _directOperatingLink;
          void _mappingVersion;
          void _mappingSources;
          return legacy;
        });
        const { error: legacyError } = await supabase.from("signal_watchlists").upsert(
          legacyRows,
          { onConflict: "signal_event_id,symbol,market" },
        );
        if (legacyError) throw legacyError;
      }
    }
  }

  console.log(JSON.stringify({
    mode: write ? "write" : "dry-run",
    signalCount: signalIds.length,
    mappedSignalCount: mapped.filter((entry) => entry.items.length > 0).length,
    noMappingSignalCount: mapped.filter((entry) => entry.items.length === 0).length,
    existingRuleBasedRows: existing?.length ?? 0,
    plannedV3Rows: watchlists.length,
    staleRows: staleRows.length,
    staleMarkets: [...new Set(staleRows.map((item) => item.market))],
    v3Markets: [...new Set(watchlists.map((item) => item.market))],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
