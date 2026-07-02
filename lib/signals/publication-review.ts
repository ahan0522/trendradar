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
  causal_reason?: string | null;
  tracking_metrics?: string[] | null;
  invalidation_conditions?: string[] | null;
  direct_operating_link?: boolean | null;
};

type BeneficiaryMappingSnapshotRow = {
  symbol: string;
  company_name: string;
  market: MarketCode;
  mapping_version: string;
  value_chain_role: string;
  causal_reason: string;
  tracking_metrics: string[];
  invalidation_conditions: string[];
  direct_operating_link: boolean;
  created_at: string;
};

type EvidenceRow = {
  title: string | null;
  summary: string | null;
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
    title?: string;
    summary?: string;
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
  const researchBrief = buildSignalResearchBrief({
    signal: input.signal,
    evidenceItems: input.evidenceItems,
    watchlists: input.watchlists,
    outcomes: input.outcomes,
    scoreComponents: input.scoreComponents,
  });
  const evidenceCoverage = researchBrief.evidenceCoverage;
  const hasRequiredEvidenceModel = (evidenceCoverage?.totalRequiredCount ?? 0) > 0;
  const evidenceCoveragePassed =
    !hasRequiredEvidenceModel || (evidenceCoverage?.missingRequired.length ?? 0) === 0;
  const evidenceCoverageValue = hasRequiredEvidenceModel
    ? `${evidenceCoverage?.satisfiedRequiredCount ?? 0}/${evidenceCoverage?.totalRequiredCount ?? 0}`
    : "n/a";
  const evidenceCoverageReason = hasRequiredEvidenceModel
    ? evidenceCoveragePassed
      ? "必要產業證據已覆蓋"
      : `缺少：${evidenceCoverage?.missingRequired.map((item) => item.label).join("、")}`
    : "尚未對應固定訊號家族，暫不套用必要證據 gate";
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
      "required_evidence_coverage",
      "必要產業證據覆蓋",
      evidenceCoveragePassed,
      hasRequiredEvidenceModel,
      evidenceCoverageValue,
      evidenceCoverageReason,
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

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const watchlistBaseSelect = "symbol, company_name, market, thesis, weight";
const watchlistResearchSelect = `${watchlistBaseSelect}, causal_reason, tracking_metrics, invalidation_conditions, direct_operating_link`;

function isMissingWatchlistResearchColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
  return /causal_reason|tracking_metrics|invalidation_conditions|direct_operating_link|schema cache|column/i.test(message);
}

async function readReviewWatchlists(supabase: ReturnType<typeof getSupabaseAdmin>, signalEventId: string) {
  const snapshotResult = await supabase
    .from("signal_beneficiary_mapping_snapshots")
    .select("symbol, company_name, market, mapping_version, value_chain_role, causal_reason, tracking_metrics, invalidation_conditions, direct_operating_link, created_at")
    .eq("signal_event_id", signalEventId)
    .order("created_at", { ascending: false })
    .returns<BeneficiaryMappingSnapshotRow[]>();
  if (!snapshotResult.error && (snapshotResult.data?.length ?? 0) > 0) {
    const latest = new Map<string, BeneficiaryMappingSnapshotRow>();
    for (const item of snapshotResult.data ?? []) {
      const key = `${item.symbol}:${item.market}`;
      if (!latest.has(key)) latest.set(key, item);
    }
    return {
      data: [...latest.values()].map((item): WatchlistRow => ({
        symbol: item.symbol,
        company_name: item.company_name,
        market: item.market,
        thesis: item.causal_reason,
        weight: 0,
        causal_reason: item.causal_reason,
        tracking_metrics: item.tracking_metrics,
        invalidation_conditions: item.invalidation_conditions,
        direct_operating_link: item.direct_operating_link,
      })),
      error: null,
    };
  }
  if (snapshotResult.error && snapshotResult.error.code !== "42P01") {
    return { data: null, error: snapshotResult.error };
  }

  const result = await supabase
    .from("signal_watchlists")
    .select(watchlistResearchSelect)
    .eq("signal_event_id", signalEventId)
    .returns<WatchlistRow[]>();

  if (!result.error || !isMissingWatchlistResearchColumns(result.error)) return result;

  return supabase
    .from("signal_watchlists")
    .select(watchlistBaseSelect)
    .eq("signal_event_id", signalEventId)
    .returns<WatchlistRow[]>();
}

async function loadEvaluationInput(signalEventId: string): Promise<PublicationEvaluationInput> {
  const supabase = getSupabaseAdmin();
  const [
    { data: signal, error: signalError },
    { data: watchlists, error: watchlistError },
    { data: evidenceItems, error: evidenceError },
    { data: outcomes, error: outcomeError },
    { data: components, error: componentError },
    { data: confidenceSnapshot, error: confidenceSnapshotError },
  ] = await Promise.all([
    supabase.from("signal_events").select("id, signal_date, as_of_date, topic, signal_strength, confidence_score, hypothesis, evidence").eq("id", signalEventId).single<SignalRow>(),
    readReviewWatchlists(supabase, signalEventId),
    supabase.from("signal_evidence_items").select("title, summary, source_name, source_type, known_at_signal_time").eq("signal_event_id", signalEventId).returns<EvidenceRow[]>(),
    supabase.from("signal_outcomes").select("horizon_days, excess_return, outcome").eq("signal_event_id", signalEventId).returns<OutcomeRow[]>(),
    supabase.from("signal_score_components").select("component_name, normalized_score").eq("signal_event_id", signalEventId).returns<ComponentRow[]>(),
    supabase
      .from("signal_research_snapshots")
      .select("confidence_score")
      .eq("signal_event_id", signalEventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ confidence_score: number }>(),
  ]);
  if (signalError) throw signalError;
  if (watchlistError) throw watchlistError;
  if (evidenceError) throw evidenceError;
  if (outcomeError) throw outcomeError;
  if (componentError) throw componentError;
  if (confidenceSnapshotError && confidenceSnapshotError.code !== "42P01") throw confidenceSnapshotError;

  return {
    signal: {
      id: signal.id,
      asOfDate: signal.as_of_date,
      topic: signal.topic,
      signalStrength: Number(signal.signal_strength),
      confidenceScore: Number(confidenceSnapshot?.confidence_score ?? signal.confidence_score),
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
      directOperatingLink: item.direct_operating_link ?? false,
    })),
    evidenceItems: (evidenceItems ?? []).map((item) => ({
      title: item.title ?? undefined,
      summary: item.summary ?? undefined,
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
    .select("*")
    .eq("signal_event_id", signalEventId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<ReviewRow>();
  if (latestError) throw latestError;
  if (latest && !["draft", "rejected"].includes(latest.status)) {
    throw new Error(`Cannot create a draft from ${latest.status}; complete the current review workflow first.`);
  }
  if (
    latest?.status === "draft" &&
    Number(latest.quality_score) === evaluation.qualityScore &&
    canonicalJson(latest.gate_results) === canonicalJson(evaluation.gates) &&
    canonicalJson(latest.publishing_brief) === canonicalJson(evaluation.publishingBrief)
  ) {
    return mapReview(latest);
  }

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

export function canTransitionPublicationReview(
  from: SignalPublicationStatus,
  to: SignalPublicationStatus,
) {
  return transitions[from].includes(to);
}

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
  if (!canTransitionPublicationReview(latest.status, input.status)) {
    throw new Error(`Invalid publication transition: ${latest.status} -> ${input.status}`);
  }
  if (latest.status === "rejected" && input.status === "draft") {
    return createPublicationDraft(input.signalEventId);
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

export async function createMissingPublicationDrafts(limit = 5) {
  const supabase = getSupabaseAdmin();
  const safeLimit = Math.max(1, Math.min(limit, 20));
  const [{ data: signals, error: signalError }, { data: reviews, error: reviewError }] = await Promise.all([
    supabase
      .from("signal_events")
      .select("id")
      .order("as_of_date", { ascending: false })
      .limit(100)
      .returns<Array<{ id: string }>>(),
    supabase
      .from("signal_publication_reviews")
      .select("signal_event_id")
      .returns<Array<{ signal_event_id: string }>>(),
  ]);
  if (signalError) throw signalError;
  if (reviewError) throw reviewError;

  const reviewed = new Set((reviews ?? []).map((item) => item.signal_event_id));
  const pending = (signals ?? []).filter((item) => !reviewed.has(item.id)).slice(0, safeLimit);
  const created: SignalPublicationReview[] = [];
  const failed: Array<{ signalEventId: string; error: string }> = [];
  for (const signal of pending) {
    try {
      created.push(await createPublicationDraft(signal.id));
    } catch (error) {
      failed.push({
        signalEventId: signal.id,
        error: error instanceof Error ? error.message : "Unknown draft evaluation error",
      });
    }
  }
  return {
    requested: pending.length,
    createdCount: created.length,
    failedCount: failed.length,
    created,
    failed,
  };
}
