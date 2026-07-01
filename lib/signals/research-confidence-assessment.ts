import { getSupabaseAdmin } from "@/lib/supabase-server";
import { EVIDENCE_MATERIALIZATION_VERSION } from "@/lib/signals/evidence-materialization";
import { assessEvidenceCoverage } from "@/lib/signals/evidence-source-registry";
import { buildSignalResearchSnapshot } from "@/lib/signals/research-snapshot";
import { calculateResearchConfidenceV2 } from "@/lib/signals/signal-engine";

export const RESEARCH_CONFIDENCE_ASSESSMENT_VERSION = "research-confidence-v4";
export const RESEARCH_CONFIDENCE_SNAPSHOT_VERSION = "signal-research-confidence-v1";

type ConfidenceEvidence = {
  id: string;
  sourceType: string;
  title: string;
  summary?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  evidenceDate?: string | null;
  knownAtSignalTime: boolean;
  sourceReliability?: number;
};

type ConfidenceMapping = {
  symbol: string;
  directOperatingLink: boolean;
  mappingSources: string[];
  trackingMetrics: string[];
  invalidationConditions: string[];
};

const contradictionPattern =
  /下修|延後|取消|下降|轉弱|降溫|見頂|示警|隱憂|供給過剩|庫存上升|未達|低於預期|需求放緩/i;

function categoryScore(evidence: ConfidenceEvidence[], sourceTypes: string[], pointsPerItem: number) {
  const unique = new Set(
    evidence
      .filter((item) => sourceTypes.includes(item.sourceType))
      .map((item) => `${item.sourceType}:${item.sourceName ?? item.id}:${item.title}`),
  );
  return Math.min(100, unique.size * pointsPerItem);
}

export function buildResearchConfidenceAssessment(input: {
  topic: string;
  hypothesis?: string;
  evidence: ConfidenceEvidence[];
  mappings: ConfidenceMapping[];
  persistenceScore?: number;
}) {
  const acceptedEvidence = input.evidence.filter((item) => item.knownAtSignalTime);
  const nonNewsEvidence = acceptedEvidence.filter((item) => item.sourceType !== "news");
  const coverage = assessEvidenceCoverage({
    topic: input.topic,
    hypothesis: input.hypothesis,
    evidenceItems: nonNewsEvidence.map((item) => ({
      sourceType: item.sourceType,
      title: item.title,
      summary: item.summary ?? undefined,
      sourceName: item.sourceName ?? undefined,
    })),
  });
  const reliabilities = nonNewsEvidence
    .map((item) => item.sourceReliability)
    .filter((value): value is number => typeof value === "number");
  const sourceQuality = reliabilities.length > 0
    ? reliabilities.reduce((sum, value) => sum + value, 0) / reliabilities.length
    : 0;
  const sourceDiversity = Math.min(
    100,
    new Set(nonNewsEvidence.map((item) => item.sourceName).filter(Boolean)).size * 25,
  );
  const mappedWithProof = input.mappings.filter(
    (item) => item.directOperatingLink && item.mappingSources.length > 0,
  ).length;
  const beneficiaryClarity = input.mappings.length > 0
    ? (mappedWithProof / input.mappings.length) * 100
    : 0;
  const contradictionCount = acceptedEvidence.filter((item) =>
    contradictionPattern.test(`${item.title} ${item.summary ?? ""}`)
  ).length;
  const requiredEvidenceCoverage = coverage.totalRequiredCount > 0
    ? (coverage.satisfiedRequiredCount / coverage.totalRequiredCount) * 100
    : 0;
  const components = {
    sourceQuality,
    sourceDiversity,
    industryEvidence: categoryScore(nonNewsEvidence, ["industry"], 35),
    commodityEvidence: categoryScore(nonNewsEvidence, ["commodity", "price"], 30),
    companyEvidence: categoryScore(nonNewsEvidence, ["company_action", "official"], 30),
    supplyChainEvidence: categoryScore(nonNewsEvidence, ["supply_chain"], 40),
    beneficiaryClarity,
    marketEvidence: 0,
    persistence: input.persistenceScore ?? 0,
    requiredEvidenceCoverage,
    contradictionPenalty: Math.min(100, contradictionCount * 25),
  };
  const score = calculateResearchConfidenceV2(components);
  const dataGaps = coverage.missingRequired.map((item) => `缺少必要證據：${item.label}`);
  if (nonNewsEvidence.length === 0) dataGaps.unshift("尚無通過嚴格閘門的非新聞證據。");
  if (input.mappings.length === 0) dataGaps.push("尚無具直接營運關係的受惠標的映射。");

  return {
    score,
    modelVersion: RESEARCH_CONFIDENCE_ASSESSMENT_VERSION,
    components,
    coverage,
    dataGaps,
  };
}

type SignalRow = {
  id: string;
  as_of_date: string;
  topic: string;
  hypothesis: string;
  signal_strength: number;
  evidence: Array<Record<string, unknown>>;
};

export async function recalculateResearchConfidenceSnapshots(asOfDate: string) {
  const supabase = getSupabaseAdmin();
  const { data: signals, error: signalError } = await supabase
    .from("signal_events")
    .select("id, as_of_date, topic, hypothesis, signal_strength, evidence")
    .eq("as_of_date", asOfDate)
    .returns<SignalRow[]>();
  if (signalError) throw signalError;
  const signalIds = (signals ?? []).map((item) => item.id);
  if (signalIds.length === 0) return { ok: true, asOfDate, snapshotCount: 0, assessments: [] };

  const [evidenceResult, mappingResult, sourceResult] = await Promise.all([
    supabase
      .from("signal_evidence_items")
      .select("id, signal_event_id, evidence_date, source_name, source_url, source_type, title, summary, known_at_signal_time")
      .in("signal_event_id", signalIds),
    supabase
      .from("signal_beneficiary_mapping_snapshots")
      .select("signal_event_id, symbol, direct_operating_link, mapping_sources, tracking_metrics, invalidation_conditions")
      .in("signal_event_id", signalIds)
      .eq("mapping_version", "beneficiary-research-v2"),
    supabase.from("research_sources").select("id, reliability_score"),
  ]);
  if (evidenceResult.error) throw evidenceResult.error;
  if (mappingResult.error && mappingResult.error.code !== "42P01") throw mappingResult.error;
  if (sourceResult.error) throw sourceResult.error;

  const reliabilityBySource = new Map(
    (sourceResult.data ?? []).map((item) => [item.id, Number(item.reliability_score)]),
  );
  const assessments = (signals ?? []).map((signal) => {
    const rawEvidence = (evidenceResult.data ?? []).filter((item) =>
      item.signal_event_id === signal.id &&
      (item.source_type === "news" || item.id.includes(`-${EVIDENCE_MATERIALIZATION_VERSION}-`)) &&
      item.known_at_signal_time &&
      (!item.evidence_date || item.evidence_date <= signal.as_of_date)
    );
    const evidence = rawEvidence.map((item) => ({
      id: item.id,
      sourceType: item.source_type,
      title: item.title,
      summary: item.summary,
      sourceName: item.source_name,
      sourceUrl: item.source_url,
      evidenceDate: item.evidence_date,
      knownAtSignalTime: item.known_at_signal_time,
      sourceReliability: reliabilityBySource.get(item.source_name),
    }));
    const mappings = (mappingResult.data ?? [])
      .filter((item) => item.signal_event_id === signal.id)
      .map((item) => ({
        symbol: item.symbol,
        directOperatingLink: item.direct_operating_link,
        mappingSources: item.mapping_sources ?? [],
        trackingMetrics: item.tracking_metrics ?? [],
        invalidationConditions: item.invalidation_conditions ?? [],
      }));
    const signalMetadata = signal.evidence?.[0] ?? {};
    const assessment = buildResearchConfidenceAssessment({
      topic: signal.topic,
      hypothesis: signal.hypothesis,
      evidence,
      mappings,
      persistenceScore: Number(signalMetadata.persistence_score ?? 0),
    });
    const snapshot = buildSignalResearchSnapshot({
      signalEventId: signal.id,
      asOfDate: signal.as_of_date,
      topic: signal.topic,
      hypothesis: signal.hypothesis,
      heatScore: Number(signal.signal_strength),
      heatState: (signalMetadata.heat_state as "emerging" | "rising" | "sustained" | "cooling" | "reactivated" | "expired") ?? "emerging",
      heatReason: String(signalMetadata.heat_reason ?? "尚未保存 Heat 原因。"),
      confidenceScore: assessment.score,
      confidenceModelVersion: assessment.modelVersion,
      evidence,
      watchlists: mappings,
      outcomes: [],
      dataGaps: assessment.dataGaps,
    });
    return { signal, assessment, snapshot };
  });

  const { error: snapshotError } = await supabase
    .from("signal_research_snapshots")
    .upsert(assessments.map(({ snapshot, assessment }) => ({
      signal_event_id: snapshot.signalEventId,
      as_of_date: snapshot.asOfDate,
      snapshot_version: RESEARCH_CONFIDENCE_SNAPSHOT_VERSION,
      heat_score: snapshot.heat.score,
      heat_state: snapshot.heat.state,
      confidence_score: snapshot.researchConfidence.score,
      confidence_model_version: assessment.modelVersion,
      validation_status: snapshot.validation.status,
      outcome_status: null,
      supporting_evidence: snapshot.supportingEvidence,
      counter_evidence: snapshot.counterEvidence,
      validation_conditions: snapshot.validation.conditions,
      invalidation_conditions: snapshot.invalidationConditions,
      data_gaps: assessment.dataGaps,
      snapshot: {
        ...snapshot,
        researchConfidence: {
          ...snapshot.researchConfidence,
          components: assessment.components,
          evidenceCoverage: assessment.coverage,
        },
      },
    })), {
      onConflict: "signal_event_id,snapshot_version",
      ignoreDuplicates: true,
    });
  if (snapshotError) throw snapshotError;

  return {
    ok: true,
    asOfDate,
    snapshotCount: assessments.length,
    assessments: assessments.map(({ signal, assessment }) => ({
      signalEventId: signal.id,
      topic: signal.topic,
      score: assessment.score,
      components: assessment.components,
      dataGaps: assessment.dataGaps,
    })),
  };
}
