import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getMonthlyDiscoverySignals } from "@/lib/signals/monthly-discovery";
import {
  buildLifecycleTransitions,
  type PreviousLifecycleSnapshot,
} from "@/lib/signals/signal-continuity";
import {
  buildSignalResearchSnapshot,
  SIGNAL_RESEARCH_SNAPSHOT_VERSION,
} from "@/lib/signals/research-snapshot";

type MonthlyEvidence = {
  sample_titles?: string[];
  sample_articles?: Array<{
    id: string;
    title: string;
    source_name: string;
    source_url: string;
    published_at: string | null;
  }>;
  company_actions?: Array<{
    id: string;
    company_symbol: string;
    company_name: string;
    action_type: string;
    title: string;
    summary?: string | null;
    known_at: string;
    source_url: string;
  }>;
  score_components?: Array<{
    componentName: string;
    rawValue: number;
    normalizedScore: number;
    weight: number;
    contribution: number;
    calculationVersion: string;
    inputSnapshot: Record<string, unknown>;
  }>;
  heat_state?: "emerging" | "rising" | "sustained" | "cooling" | "reactivated" | "expired";
  heat_reason?: string;
};

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isMissingWatchlistResearchColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
  return /value_chain_role|causal_reason|tracking_metrics|invalidation_conditions|direct_operating_link|mapping_version|mapping_sources|schema cache|column/i.test(message);
}

export async function finalizeMonthlySignals(asOfDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) throw new Error("asOfDate must use YYYY-MM-DD");
  if (asOfDate > currentTaipeiDate()) throw new Error("Cannot finalize a future month");

  const signals = await getMonthlyDiscoverySignals(asOfDate);
  if (signals.length === 0) {
    return { ok: true, asOfDate, signalCount: 0, watchlistCount: 0, evidenceCount: 0, componentCount: 0 };
  }

  const supabase = getSupabaseAdmin();
  const signalRows = signals.map((signal) => ({
    id: signal.id,
    signal_date: signal.signalDate,
    as_of_date: signal.asOfDate,
    topic: signal.topic,
    signal_type: signal.signalType,
    signal_strength: signal.signalStrength,
    confidence_score: signal.confidenceScore,
    hypothesis: signal.hypothesis,
    evidence: signal.evidence,
    status: "active",
    model_version: signal.modelVersion ?? "monthly-full-market-v1",
    updated_at: new Date().toISOString(),
  }));
  const { error: signalError } = await supabase
    .from("signal_events")
    .upsert(signalRows, { onConflict: "id", ignoreDuplicates: true });
  if (signalError) throw signalError;

  const watchlistRows = signals.flatMap((signal) =>
    signal.watchlists.map((item) => ({
      id: `${signal.id}-${item.market.toLowerCase()}-${item.symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      signal_event_id: signal.id,
      symbol: item.symbol,
      company_name: item.companyName,
      market: item.market,
      thesis: item.thesis,
      weight: item.weight,
      source: item.source ?? "monthly-rule-based",
      value_chain_role: item.valueChainRole ?? null,
      causal_reason: item.causalReason ?? null,
      tracking_metrics: item.trackingMetrics ?? [],
      invalidation_conditions: item.invalidationConditions ?? [],
      direct_operating_link: item.directOperatingLink ?? false,
      mapping_version: item.mappingVersion ?? null,
      mapping_sources: item.mappingSources ?? [],
      updated_at: new Date().toISOString(),
    })),
  );
  const signalIds = signals.map((signal) => signal.id);
  const { error: cleanupError } = await supabase
    .from("signal_watchlists")
    .delete()
    .in("signal_event_id", signalIds)
    .in("source", ["rule-based", "monthly-rule-based"]);
  if (cleanupError) throw cleanupError;

  if (watchlistRows.length > 0) {
    const { error: watchlistError } = await supabase
      .from("signal_watchlists")
      .upsert(watchlistRows, { onConflict: "signal_event_id,symbol,market" });
    if (watchlistError) {
      if (!isMissingWatchlistResearchColumns(watchlistError)) throw watchlistError;
      const legacyRows = watchlistRows.map((item) => {
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
      const { error: legacyError } = await supabase
        .from("signal_watchlists")
        .upsert(legacyRows, { onConflict: "signal_event_id,symbol,market" });
      if (legacyError) throw legacyError;
    }
  }

  const beneficiaryMappingRows = signals.flatMap((signal) =>
    signal.watchlists
      .filter((item) => item.directOperatingLink && item.mappingVersion)
      .map((item) => ({
        signal_event_id: signal.id,
        symbol: item.symbol,
        market: item.market,
        company_name: item.companyName,
        mapping_version: item.mappingVersion,
        value_chain_role: item.valueChainRole ?? "",
        causal_reason: item.causalReason ?? "",
        tracking_metrics: item.trackingMetrics ?? [],
        invalidation_conditions: item.invalidationConditions ?? [],
        mapping_sources: item.mappingSources ?? [],
        direct_operating_link: true,
        as_of_date: signal.asOfDate,
      })),
  );
  let beneficiaryMappingSnapshotCount = 0;
  if (beneficiaryMappingRows.length > 0) {
    const { error: beneficiaryMappingError } = await supabase
      .from("signal_beneficiary_mapping_snapshots")
      .upsert(beneficiaryMappingRows, {
        onConflict: "signal_event_id,symbol,market,mapping_version",
        ignoreDuplicates: true,
      });
    if (beneficiaryMappingError && beneficiaryMappingError.code !== "42P01") {
      throw beneficiaryMappingError;
    }
    if (!beneficiaryMappingError) beneficiaryMappingSnapshotCount = beneficiaryMappingRows.length;
  }

  const evidenceRows = signals.flatMap((signal) => {
    const evidence = (signal.evidence[0] ?? {}) as MonthlyEvidence;
    const structuredArticles = evidence.sample_articles ?? [];
    const newsRows = structuredArticles.length > 0
      ? structuredArticles.map((article) => ({
      id: `${signal.id}-news-${article.id}`,
      signal_event_id: signal.id,
      evidence_date: article.published_at?.slice(0, 10) ?? signal.asOfDate,
      source_name: article.source_name,
      source_url: article.source_url,
      source_type: "news",
      title: article.title,
      summary: "訊號形成當時已發布的代表文章。",
      why_it_matters: "支持市場討論正在集中，但仍需其他證據交叉驗證。",
      known_at_signal_time: true,
    }))
      : (evidence.sample_titles ?? []).map((title, index) => ({
          id: `${signal.id}-news-${index + 1}`,
          signal_event_id: signal.id,
          evidence_date: signal.asOfDate,
          source_name: "monthly-articles",
          source_type: "news",
          title,
          summary: "舊版訊號只保存標題，來源連結待補。",
          why_it_matters: "支持市場討論正在集中，但因缺少來源連結，證據品質較低。",
          known_at_signal_time: true,
        }));
    const companyRows = (evidence.company_actions ?? []).map((item) => ({
      id: `${signal.id}-company-${item.id}`,
      signal_event_id: signal.id,
      evidence_date: item.known_at.slice(0, 10),
      source_name: item.company_name,
      source_url: item.source_url,
      source_type: "company_action",
      title: `${item.company_symbol}：${item.title}`,
      summary: item.summary ?? null,
      why_it_matters: "正式公司行動可驗證新聞主題是否轉化為企業決策。",
      known_at_signal_time: true,
    }));
    return [...companyRows, ...newsRows];
  });
  if (evidenceRows.length > 0) {
    const { error: evidenceError } = await supabase
      .from("signal_evidence_items")
      .upsert(evidenceRows, { onConflict: "id", ignoreDuplicates: true });
    if (evidenceError) throw evidenceError;
  }

  const evidenceBySignal = new Map<string, typeof evidenceRows>();
  for (const item of evidenceRows) {
    const rows = evidenceBySignal.get(item.signal_event_id) ?? [];
    rows.push(item);
    evidenceBySignal.set(item.signal_event_id, rows);
  }
  const researchSnapshots = signals.map((signal) => {
    const evidence = (signal.evidence[0] ?? {}) as MonthlyEvidence;
    return buildSignalResearchSnapshot({
      signalEventId: signal.id,
      asOfDate: signal.asOfDate,
      topic: signal.topic,
      hypothesis: signal.hypothesis,
      heatScore: signal.signalStrength,
      heatState: evidence.heat_state ?? "emerging",
      heatReason: evidence.heat_reason ?? "尚未保存 Heat 原因。",
      confidenceScore: signal.confidenceScore,
      confidenceModelVersion: signal.modelVersion ?? "monthly-full-market-v3",
      evidence: (evidenceBySignal.get(signal.id) ?? []).map((item) => ({
        id: item.id,
        sourceType: item.source_type,
        title: item.title,
        summary: item.summary,
        sourceName: item.source_name,
        sourceUrl: "source_url" in item ? item.source_url : null,
        evidenceDate: item.evidence_date,
        knownAtSignalTime: item.known_at_signal_time,
      })),
      watchlists: signal.watchlists.map((item) => ({
        symbol: item.symbol,
        trackingMetrics: item.trackingMetrics,
        invalidationConditions: item.invalidationConditions,
      })),
      outcomes: [],
      dataGaps: [
        "尚待產業、商品、公司與市場證據進一步交叉驗證。",
        "尚無成熟的 7/30/60/90 日 Outcome。",
      ],
    });
  });
  const { error: snapshotError } = await supabase
    .from("signal_research_snapshots")
    .upsert(researchSnapshots.map((snapshot) => ({
      signal_event_id: snapshot.signalEventId,
      as_of_date: snapshot.asOfDate,
      snapshot_version: SIGNAL_RESEARCH_SNAPSHOT_VERSION,
      heat_score: snapshot.heat.score,
      heat_state: snapshot.heat.state,
      confidence_score: snapshot.researchConfidence.score,
      confidence_model_version: snapshot.researchConfidence.modelVersion,
      validation_status: snapshot.validation.status,
      outcome_status: snapshot.outcome?.outcome ?? null,
      supporting_evidence: snapshot.supportingEvidence,
      counter_evidence: snapshot.counterEvidence,
      validation_conditions: snapshot.validation.conditions,
      invalidation_conditions: snapshot.invalidationConditions,
      data_gaps: snapshot.researchConfidence.dataGaps,
      snapshot,
    })), {
      onConflict: "signal_event_id,snapshot_version",
      ignoreDuplicates: true,
    });
  if (snapshotError && snapshotError.code !== "42P01") throw snapshotError;

  const componentRows = signals.flatMap((signal) => {
    const evidence = (signal.evidence[0] ?? {}) as MonthlyEvidence;
    return (evidence.score_components ?? []).map((item) => ({
      signal_event_id: signal.id,
      component_name: item.componentName,
      raw_value: item.rawValue,
      normalized_score: item.normalizedScore,
      weight: item.weight,
      contribution: item.contribution,
      calculation_version: item.calculationVersion,
      input_snapshot: item.inputSnapshot,
      calculated_at: `${signal.asOfDate}T23:59:59.000Z`,
    }));
  });
  if (componentRows.length > 0) {
    const { error: componentError } = await supabase
      .from("signal_score_components")
      .upsert(componentRows, { onConflict: "signal_event_id,component_name", ignoreDuplicates: true });
    if (componentError) throw componentError;
  }

  let lifecycleCount = 0;
  const { data: lifecycleRows, error: lifecycleReadError } = await supabase
    .from("signal_lifecycle_snapshots")
    .select("continuity_key, signal_event_id, as_of_date, last_seen_as_of, lifecycle_state")
    .lt("as_of_date", asOfDate)
    .order("as_of_date", { ascending: false });
  if (!lifecycleReadError) {
    const latestByKey = new Map<string, PreviousLifecycleSnapshot>();
    for (const row of lifecycleRows ?? []) {
      if (latestByKey.has(row.continuity_key)) continue;
      latestByKey.set(row.continuity_key, {
        continuityKey: row.continuity_key,
        signalEventId: row.signal_event_id,
        asOfDate: row.as_of_date,
        lastSeenAsOf: row.last_seen_as_of,
        lifecycleState: row.lifecycle_state,
      });
    }
    const transitions = buildLifecycleTransitions(
      signals.map((signal) => {
        const evidence = (signal.evidence[0] ?? {}) as MonthlyEvidence;
        return {
          signalEventId: signal.id,
          topic: signal.topic,
          asOfDate,
          lifecycleState: evidence.heat_state ?? "emerging",
          lifecycleReason: evidence.heat_reason ?? "本月首次建立生命週期快照。",
        };
      }),
      [...latestByKey.values()],
      asOfDate,
    );
    if (transitions.length > 0) {
      const { error: lifecycleWriteError } = await supabase
        .from("signal_lifecycle_snapshots")
        .upsert(transitions.map((item) => ({
          continuity_key: item.continuityKey,
          signal_event_id: item.signalEventId,
          as_of_date: item.asOfDate,
          last_seen_as_of: item.lastSeenAsOf,
          lifecycle_state: item.lifecycleState,
          previous_state: item.previousState,
          transition_reason: item.transitionReason,
          model_version: "signal-lifecycle-v1",
        })), {
          onConflict: "continuity_key,as_of_date,model_version",
          ignoreDuplicates: true,
        });
      if (lifecycleWriteError) throw lifecycleWriteError;
      lifecycleCount = transitions.length;
    }
  } else if (lifecycleReadError.code !== "42P01") {
    throw lifecycleReadError;
  }

  return {
    ok: true,
    asOfDate,
    signalCount: signalRows.length,
    watchlistCount: watchlistRows.length,
    evidenceCount: evidenceRows.length,
    componentCount: componentRows.length,
    lifecycleCount,
    researchSnapshotCount: snapshotError ? 0 : researchSnapshots.length,
    beneficiaryMappingSnapshotCount,
  };
}

export function previousMonthEnd(date = new Date()) {
  const taipei = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  return new Date(Date.UTC(taipei.getFullYear(), taipei.getMonth(), 0)).toISOString().slice(0, 10);
}
