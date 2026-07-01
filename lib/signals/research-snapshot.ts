import type { HeatLifecycle } from "@/lib/discovery/heat-lifecycle";

export const SIGNAL_RESEARCH_SNAPSHOT_VERSION = "signal-research-v2";

type SnapshotEvidence = {
  id: string;
  sourceType: string;
  title: string;
  summary?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  evidenceDate?: string | null;
  knownAtSignalTime: boolean;
};

type SnapshotWatchlist = {
  symbol: string;
  trackingMetrics?: string[];
  invalidationConditions?: string[];
};

type SnapshotOutcome = {
  horizonDays: number;
  basketReturn: number | null;
  benchmarkReturn: number | null;
  excessReturn: number | null;
  outcome: "success" | "partial" | "failed" | "pending";
};

const counterEvidencePattern =
  /反證|不支持|下修|延後|取消|下降|轉弱|降溫|見頂|示警|隱憂|利多將盡|供給過剩|庫存上升|未達|低於預期|需求放緩|恐無疾而終/i;

export function buildSignalResearchSnapshot(input: {
  signalEventId: string;
  asOfDate: string;
  topic: string;
  hypothesis: string;
  heatScore: number;
  heatState: HeatLifecycle;
  heatReason: string;
  confidenceScore: number;
  confidenceModelVersion: string;
  evidence: SnapshotEvidence[];
  watchlists: SnapshotWatchlist[];
  outcomes?: SnapshotOutcome[];
  dataGaps?: string[];
}) {
  const knownEvidence = input.evidence.filter(
    (item) => item.knownAtSignalTime && (!item.evidenceDate || item.evidenceDate <= input.asOfDate),
  );
  const counterEvidence = knownEvidence.filter((item) =>
    counterEvidencePattern.test(`${item.title} ${item.summary ?? ""}`),
  );
  const counterIds = new Set(counterEvidence.map((item) => item.id));
  const supportingEvidence = knownEvidence.filter((item) => !counterIds.has(item.id));
  const validationConditions = [...new Set(input.watchlists.flatMap((item) => item.trackingMetrics ?? []))];
  const invalidationConditions = [...new Set(
    input.watchlists.flatMap((item) => item.invalidationConditions ?? []),
  )];
  const completedOutcomes = (input.outcomes ?? [])
    .filter((item) => item.outcome !== "pending")
    .sort((a, b) => b.horizonDays - a.horizonDays);
  const latestOutcome = completedOutcomes[0] ?? null;

  return {
    schemaVersion: SIGNAL_RESEARCH_SNAPSHOT_VERSION,
    signalEventId: input.signalEventId,
    asOfDate: input.asOfDate,
    topic: input.topic,
    hypothesis: input.hypothesis,
    heat: {
      score: input.heatScore,
      state: input.heatState,
      reason: input.heatReason,
    },
    researchConfidence: {
      score: input.confidenceScore,
      modelVersion: input.confidenceModelVersion,
      supportingEvidenceCount: supportingEvidence.length,
      counterEvidenceCount: counterEvidence.length,
      dataGaps: input.dataGaps ?? [],
    },
    validation: {
      status: latestOutcome ? "completed" as const : "pending" as const,
      conditions: validationConditions,
    },
    outcome: latestOutcome,
    supportingEvidence,
    counterEvidence,
    invalidationConditions,
    recordedAt: `${input.asOfDate}T23:59:59.000Z`,
  };
}
