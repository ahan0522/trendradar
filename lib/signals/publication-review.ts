import { getSupabaseAdmin } from "@/lib/supabase-server";
import { buildSignalResearchBrief } from "@/lib/signals/research-brief";
import type {
  MarketCode,
  PublicationGateResult,
  SignalPublicationReview,
  SignalPublicationStatus,
  SignalPublishingBrief,
} from "@/types/signals";

type SignalRow = {
  id: string;
  signal_date: string;
  as_of_date: string;
  topic: string;
  signal_strength: number;
  confidence_score: number;
  hypothesis: string;
  evidence: unknown[];
};

type WatchlistRow = {
  symbol: string;
  company_name: string;
  market: MarketCode;
  thesis: string;
  weight: number;
  causal_reason: string | null;
  tracking_metrics: string[];
  invalidation_conditions: string[];
  direct_operating_link: boolean;
};

type EvidenceRow = {
  source_name: string | null;
  source_type: string;
  known_at_signal_time: boolean;
};

type OutcomeRow = {
  horizon_days: number;
  excess_return: number;
  outcome: string;
};

type ComponentRow = {
  component_name: string;
  normalized_score: number;
};

type ReviewRow = {
  id: string;
  signal_event_id: string;
  version: number;
  status: SignalPublicationStatus;
  quality_score: number;
  gate_results: PublicationGateResult[];
  publishing_brief: SignalPublishingBrief;
  review_note: string | null;
  reviewed_by: string | null;
  created_at: string;
};

export type PublicationEvaluationInput = {
  signal: {
    id: string;
    asOfDate: string;
    topic: string;
    signalStrength: number;
    confidenceScore: number;
    hypothesis: string;
    evidence: unknown[];
  };
  watchlists: Array<{
    symbol: string;
    companyName: string;
    market: MarketCode;
    thesis: string;
    causalReason?: string;
    trackingMetrics?: string[];
    invalidationConditions?: string[];
    directOperatingLink?: boolean;
  }>;
  evidenceItems: Array<{
    sourceName?: string;
    sourceType: string;
    knownAtSignalTime: boolean;
  }>;
  outcomes: Array<{
    horizon_days: number;
    excess_return: number;
    outcome: string;
  }>;
  scoreComponents: Array<{
    componentName: string;
    normalizedScore: number;
  }>;
};

function metric(signal: PublicationEvaluationInput["signal"]) {
  return (signal.evidence[0] ?? {}) as {
    source_count?: number;
    event_count?: number;
    article_count?: number;
  };
}

function gate(
  key: string,
  label: string,
  passed: boolean,
  required: boolean,
  value: number | string | boolean,
  reason: string,
): PublicationGateResult {
  return { key, label, passed, required, value, reason };
}

export function evaluateSignalForPublication(input: PublicationEvaluationInput) {
  const data = metric(input.signal);
  const sourceCount = Number(
    data.source_count ??
      new Set(input.evidenceItems.map((item) => item.sourceName).filter(Boolean)).size,
  );
  const eventCount = Number(data.event_count ?? data.article_count ?? input.evidenceItems.length);
  const knownEvidence = input.evidenceItems.filter((item) => item.knownAtSignalTime);
  const primaryEvidence = knownEvidence.filter((item) =>
    ["official", "company_action", "supply_chain", "price"].includes(item.sourceType),
  );
  const mapped = input.watchlists.filter((item) =>
    item.directOperatingLink === true &&
    (item.causalReason ?? item.thesis).trim().length >= 12 &&
    (item.trackingMetrics?.length ?? 0) > 0 &&
    (item.invalidationConditions?.length ?? 0) > 0,
  );
  const gates = [
    gate("source_diversity", "至少 3 個有效來源", sourceCount >= 3, true, sourceCount, `${sourceCount} 個有效來源`),
    gate("event_depth", "至少 3 個研究事件", eventCount >= 3, true, eventCount, `${eventCount} 個去重事件`),
    gate(
      "confidence",
      "研究信心至少 60",
      input.signal.confidenceScore >= 60,
      true,
      input.signal.confidenceScore,
      `Research Confidence ${input.signal.confidenceScore.toFixed(1)}`,
    ),
    gate(
      "signal_strength",
      "訊號強度至少 50",
      input.signal.signalStrength >= 50,
      true,
      input.signal.signalStrength,
      `Signal Strength ${input.signal.signalStrength.toFixed(1)}`,
    ),
    gate(
      "known_evidence",
      "至少 3 筆當時可得證據",
      knownEvidence.length >= 3,
      true,
      knownEvidence.length,
      `${knownEvidence.length} 筆符合 as_of_date`,
    ),
    gate(
      "beneficiary_mapping",
      "至少 1 檔具直接營運關係與驗證條件的觀察標的",
      mapped.length >= 1,
      true,
      mapped.length,
      `${mapped.length} 檔通過標的理由檢查`,
    ),
    gate(
      "primary_evidence",
      "具一手或非新聞證據",
      primaryEvidence.length >= 1,
      false,
      primaryEvidence.length,
      primaryEvidence.length > 0 ? "已有非新聞證據" : "仍以新聞證據為主",
    ),
  ];
  const required = gates.filter((item) => item.required);
  const eligible = required.every((item) => item.passed);
  const qualityScore = Number(
    Math.min(
      100,
      gates.reduce((sum, item) => sum + (item.passed ? (item.required ? 16 : 4) : 0), 0) +
        Math.min(primaryEvidence.length, 2) * 2,
    ).toFixed(1),
  );

  const researchBrief = buildSignalResearchBrief({
    signal: input.signal,
    evidenceItems: input.evidenceItems,
    watchlists: input.watchlists,
    outcomes: input.outcomes,
    scoreComponents: input.scoreComponents,
  });
  const publishingBrief: SignalPublishingBrief = {
    signalEventId: input.signal.id,
    asOfDate: input.signal.asOfDate,
    headline: input.signal.topic.replace(/^\d{4}-\d{2}\s*/, ""),
    whyItMatters: input.signal.hypothesis,
    evidenceSummary: researchBrief.evidenceAssessment.summary,
    attentionDirections: input.watchlists.map((item) => ({
      symbol: item.symbol,
      companyName: item.companyName,
      market: item.market,
      reason: item.causalReason ?? item.thesis,
    })),
    trackingIndicators: researchBrief.trackingIndicators,
    invalidationConditions: researchBrief.invalidationConditions,
    validationSummary: researchBrief.validationSummary.summary,
    disclosure: "本內容為市場研究與追蹤方向，不構成買賣建議；訊號可能失敗，應自行查證並承擔決策風險。",
  };

  return { eligible, qualityScore, gates, publishingBrief };
}

function mapReview(row: ReviewRow): SignalPublicationReview {
  const required = row.gate_results.filter((item) => item.required);
  return {
    id: row.id,
    signalEventId: row.signal_event_id,
    version: row.version,
    status: row.status,
    qualityScore: Number(row.quality_score),
    eligible: required.every((item) => item.passed),
    gateResults: row.gate_results,
    publishingBrief: row.publishing_brief,
    reviewNote: row.review_note ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    createdAt: row.created_at,
  };
}

async function loadEvaluationInput(signalEventId: string): Promise<PublicationEvaluationInput> {
  const supabase = getSupabaseAdmin();
  const [
    { data: signal, error: signalError },
    { data: watchlists, error: watchlistError },
    { data: evidenceItems, error: evidenceError },
    { data: outcomes, error: outcomeError },
    { data: components, error: componentError },
  ] = await Promise.all([
    supabase.from("signal_events").select("id, signal_date, as_of_date, topic, signal_strength, confidence_score, hypothesis, evidence").eq("id", signalEventId).single<SignalRow>(),
    supabase.from("signal_watchlists").select("symbol, company_name, market, thesis, weight, causal_reason, tracking_metrics, invalidation_conditions, direct_operating_link").eq("signal_event_id", signalEventId).returns<WatchlistRow[]>(),
    supabase.from("signal_evidence_items").select("source_name, source_type, known_at_signal_time").eq("signal_event_id", signalEventId).returns<EvidenceRow[]>(),
    supabase.from("signal_outcomes").select("horizon_days, excess_return, outcome").eq("signal_event_id", signalEventId).returns<OutcomeRow[]>(),
    supabase.from("signal_score_components").select("component_name, normalized_score").eq("signal_event_id", signalEventId).returns<ComponentRow[]>(),
  ]);
  if (signalError) throw signalError;
  if (watchlistError) throw watchlistError;
  if (evidenceError) throw evidenceError;
  if (outcomeError) throw outcomeError;
  if (componentError) throw componentError;

  return {
    signal: {
      id: signal.id,
      asOfDate: signal.as_of_date,
      topic: signal.topic,
      signalStrength: Number(signal.signal_strength),
      confidenceScore: Number(signal.confidence_score),
      hypothesis: signal.hypothesis,
      evidence: signal.evidence,
    },
    watchlists: (watchlists ?? []).map((item) => ({
      symbol: item.symbol,
      companyName: item.company_name,
      market: item.market,
      thesis: item.thesis,
      causalReason: item.causal_reason ?? undefined,
      trackingMetrics: item.tracking_metrics ?? [],
      invalidationConditions: item.invalidation_conditions ?? [],
      directOperatingLink: item.direct_operating_link,
    })),
    evidenceItems: (evidenceItems ?? []).map((item) => ({
      sourceName: item.source_name ?? undefined,
      sourceType: item.source_type,
      knownAtSignalTime: item.known_at_signal_time,
    })),
    outcomes: outcomes ?? [],
    scoreComponents: (components ?? []).map((item) => ({
      componentName: item.component_name,
      normalizedScore: Number(item.normalized_score),
    })),
  };
}

export async function createPublicationDraft(signalEventId: string) {
  const input = await loadEvaluationInput(signalEventId);
  const evaluation = evaluateSignalForPublication(input);
  const supabase = getSupabaseAdmin();
  const { data: latest, error: latestError } = await supabase
    .from("signal_publication_reviews")
    .select("version")
    .eq("signal_event_id", signalEventId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{ version: number }>();
  if (latestError) throw latestError;

  const { data, error } = await supabase
    .from("signal_publication_reviews")
    .insert({
      signal_event_id: signalEventId,
      version: Number(latest?.version ?? 0) + 1,
      status: "draft",
      quality_score: evaluation.qualityScore,
      gate_results: evaluation.gates,
      publishing_brief: evaluation.publishingBrief,
    })
    .select("*")
    .single<ReviewRow>();
  if (error) throw error;
  return mapReview(data);
}

const transitions: Record<SignalPublicationStatus, SignalPublicationStatus[]> = {
  draft: ["reviewed", "rejected"],
  reviewed: ["approved", "rejected"],
  approved: ["published", "rejected"],
  rejected: ["draft"],
  published: [],
};

export async function transitionPublicationReview(input: {
  signalEventId: string;
  status: SignalPublicationStatus;
  reviewNote?: string;
  reviewedBy?: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data: latest, error: latestError } = await supabase
    .from("signal_publication_reviews")
    .select("*")
    .eq("signal_event_id", input.signalEventId)
    .order("version", { ascending: false })
    .limit(1)
    .single<ReviewRow>();
  if (latestError) throw latestError;
  if (!transitions[latest.status].includes(input.status)) {
    throw new Error(`Invalid publication transition: ${latest.status} -> ${input.status}`);
  }
  const requiredPassed = latest.gate_results
    .filter((item) => item.required)
    .every((item) => item.passed);
  if (["approved", "published"].includes(input.status) && !requiredPassed) {
    throw new Error("Required publication gates have not passed.");
  }

  const { data, error } = await supabase
    .from("signal_publication_reviews")
    .insert({
      signal_event_id: input.signalEventId,
      version: latest.version + 1,
      status: input.status,
      quality_score: latest.quality_score,
      gate_results: latest.gate_results,
      publishing_brief: latest.publishing_brief,
      review_note: input.reviewNote?.trim() || null,
      reviewed_by: input.reviewedBy?.trim() || "internal",
    })
    .select("*")
    .single<ReviewRow>();
  if (error) throw error;
  return mapReview(data);
}

export async function listLatestPublicationReviews() {
  const { data, error } = await getSupabaseAdmin()
    .from("signal_publication_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<ReviewRow[]>();
  if (error) throw error;

  const latest = new Map<string, ReviewRow>();
  for (const row of data ?? []) {
    if (!latest.has(row.signal_event_id)) latest.set(row.signal_event_id, row);
  }
  return [...latest.values()].map(mapReview);
}
