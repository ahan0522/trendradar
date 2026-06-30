import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  getMonthlyDiscoverySignals,
  MONTHLY_DISCOVERY_MODEL_VERSION,
} from "@/lib/signals/monthly-discovery";

type BaselineSignalRow = {
  id: string;
  topic: string;
  signal_strength: number;
  confidence_score: number;
  evidence: unknown[];
  model_version: string | null;
};

export type ReplaySignal = {
  id: string;
  topic: string;
  family: string;
  category: string;
  strength: number;
  confidence: number;
  sourceCount: number;
  articleCount: number;
  modelVersion: string;
};

export type ReplayMonthMetrics = {
  baselineCount: number;
  candidateCount: number;
  baselineFamilies: string[];
  candidateFamilies: string[];
  retainedFamilies: string[];
  newlyDiscoveredFamilies: string[];
  missedBaselineFamilies: string[];
  familyOverlapRate: number;
  baselineDiversity: number;
  candidateDiversity: number;
  baselineAverageConfidence: number;
  candidateAverageConfidence: number;
  baselineAverageSources: number;
  candidateAverageSources: number;
};

export type ModelReplayMonth = {
  month: string;
  asOfDate: string;
  baselineSignals: ReplaySignal[];
  candidateSignals: ReplaySignal[];
  metrics: ReplayMonthMetrics;
};

function lastDayOfMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function nextMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 7);
}

function monthRange(startMonth: string, endMonth: string) {
  const result: string[] = [];
  for (let month = startMonth; month <= endMonth; month = nextMonth(month)) result.push(month);
  return result;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function roundRate(value: number) {
  return Number(value.toFixed(3));
}

export function normalizeSignalFamily(value: string) {
  const text = value.toLowerCase();
  const families: Array<[string, RegExp]> = [
    ["memory", /memory|dram|nand|hbm|記憶體/],
    ["power-grid", /power|grid|electric|電力|電網|變壓器|核能/],
    ["semiconductor", /semiconductor|半導體|晶片|晶圓|先進製程/],
    ["advanced-packaging", /cowos|packag|封裝/],
    ["ai-compute", /ai|人工智慧|算力|gpu|資料中心/],
    ["defense-geopolitics", /defense|military|war|國防|軍工|戰爭|地緣|台海|中東|俄烏|伊朗|美軍|衝突/],
    ["energy-commodities", /energy|oil|gas|commodity|能源|原油|天然氣|原物料|黃金|銅價/],
    ["biotech-health", /biotech|health|medical|drug|生技|醫療|新藥|藥物|疫苗/],
    ["robotics", /robot|automation|機器人|自動化/],
    ["trade-tariffs", /tariff|trade|關稅|貿易|出口管制|制裁/],
    ["macro-rates", /rate|inflation|macro|利率|通膨|聯準會|央行|總體/],
    ["ev-battery", /\bev\b|battery|電動車|電池|儲能/],
    ["optical-network", /cpo|optical|network|光通訊|矽光子|網通/],
  ];
  return families.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
}

function readEvidenceMetric(evidence: unknown[]) {
  const item = (evidence[0] ?? {}) as {
    category?: string;
    source_count?: number;
    article_count?: number;
  };
  return {
    category: item.category ?? "未分類",
    sourceCount: Number(item.source_count ?? 0),
    articleCount: Number(item.article_count ?? 0),
  };
}

function mapBaselineSignal(row: BaselineSignalRow): ReplaySignal {
  const metric = readEvidenceMetric(row.evidence);
  return {
    id: row.id,
    topic: row.topic,
    family: normalizeSignalFamily(row.topic),
    category: metric.category,
    strength: Number(row.signal_strength),
    confidence: Number(row.confidence_score),
    sourceCount: metric.sourceCount,
    articleCount: metric.articleCount,
    modelVersion: row.model_version ?? "unknown",
  };
}

function buildMetrics(baselineSignals: ReplaySignal[], candidateSignals: ReplaySignal[]): ReplayMonthMetrics {
  const baselineFamilies = [...new Set(baselineSignals.map((item) => item.family))].sort();
  const candidateFamilies = [...new Set(candidateSignals.map((item) => item.family))].sort();
  const baselineSet = new Set(baselineFamilies);
  const candidateSet = new Set(candidateFamilies);
  const retainedFamilies = candidateFamilies.filter((item) => baselineSet.has(item));
  const newlyDiscoveredFamilies = candidateFamilies.filter((item) => !baselineSet.has(item));
  const missedBaselineFamilies = baselineFamilies.filter((item) => !candidateSet.has(item));
  const unionCount = new Set([...baselineFamilies, ...candidateFamilies]).size;

  return {
    baselineCount: baselineSignals.length,
    candidateCount: candidateSignals.length,
    baselineFamilies,
    candidateFamilies,
    retainedFamilies,
    newlyDiscoveredFamilies,
    missedBaselineFamilies,
    familyOverlapRate: unionCount > 0 ? roundRate(retainedFamilies.length / unionCount) : 0,
    baselineDiversity: baselineSignals.length > 0 ? roundRate(baselineFamilies.length / baselineSignals.length) : 0,
    candidateDiversity: candidateSignals.length > 0 ? roundRate(candidateFamilies.length / candidateSignals.length) : 0,
    baselineAverageConfidence: average(baselineSignals.map((item) => item.confidence)),
    candidateAverageConfidence: average(candidateSignals.map((item) => item.confidence)),
    baselineAverageSources: average(baselineSignals.map((item) => item.sourceCount)),
    candidateAverageSources: average(candidateSignals.map((item) => item.sourceCount)),
  };
}

export async function replayModelMonth(month: string): Promise<ModelReplayMonth> {
  const asOfDate = lastDayOfMonth(month);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("signal_events")
    .select("id, topic, signal_strength, confidence_score, evidence, model_version")
    .gte("signal_date", `${month}-01`)
    .lte("signal_date", asOfDate)
    .eq("model_version", "monthly-signal-v2")
    .order("signal_strength", { ascending: false })
    .returns<BaselineSignalRow[]>();
  if (error) throw error;

  const baselineSignals = (data ?? []).map(mapBaselineSignal);
  const discoveredSignals = (await getMonthlyDiscoverySignals(asOfDate)).map((signal) => {
    const metric = readEvidenceMetric(signal.evidence);
    return {
      id: signal.id,
      topic: signal.topic,
      family: normalizeSignalFamily(signal.topic),
      category: metric.category,
      strength: signal.signalStrength,
      confidence: signal.confidenceScore,
      sourceCount: metric.sourceCount,
      articleCount: metric.articleCount,
      modelVersion: signal.modelVersion ?? MONTHLY_DISCOVERY_MODEL_VERSION,
    };
  });
  const candidateSignals = [...new Map(
    discoveredSignals.map((signal) => [signal.id, signal]),
  ).values()];

  return {
    month,
    asOfDate,
    baselineSignals,
    candidateSignals,
    metrics: buildMetrics(baselineSignals, candidateSignals),
  };
}

function buildRunSummary(rows: ModelReplayMonth[]) {
  const newFamilies = rows.flatMap((row) => row.metrics.newlyDiscoveredFamilies);
  const uniqueNewFamilies = [...new Set(newFamilies)].sort();
  const averageBaselineFamilyCount = average(rows.map((row) => row.metrics.baselineFamilies.length));
  const averageCandidateFamilyCount = average(rows.map((row) => row.metrics.candidateFamilies.length));
  return {
    monthCount: rows.length,
    baselineSignalCount: rows.reduce((sum, row) => sum + row.metrics.baselineCount, 0),
    candidateSignalCount: rows.reduce((sum, row) => sum + row.metrics.candidateCount, 0),
    averageFamilyOverlapRate: average(rows.map((row) => row.metrics.familyOverlapRate)),
    averageBaselineDiversity: average(rows.map((row) => row.metrics.baselineDiversity)),
    averageCandidateDiversity: average(rows.map((row) => row.metrics.candidateDiversity)),
    averageBaselineFamilyCount,
    averageCandidateFamilyCount,
    coverageBreadthLift: averageBaselineFamilyCount > 0
      ? Number(((averageCandidateFamilyCount - averageBaselineFamilyCount) / averageBaselineFamilyCount).toFixed(3))
      : 0,
    newlyDiscoveredFamilies: uniqueNewFamilies,
    monthsWithNewFamilies: rows.filter((row) => row.metrics.newlyDiscoveredFamilies.length > 0).length,
    performanceComparisonStatus: "pending_parallel_backtest",
  };
}

export async function runModelReplayRange(options: {
  startMonth: string;
  endMonth: string;
  runId?: string;
}) {
  const runId = options.runId ?? `replay-${options.startMonth}-${options.endMonth}-${Date.now()}`;
  const supabase = getSupabaseAdmin();
  const months = monthRange(options.startMonth, options.endMonth);

  const { error: runError } = await supabase.from("model_replay_runs").upsert({
    id: runId,
    candidate_model_version: MONTHLY_DISCOVERY_MODEL_VERSION,
    baseline_model_version: "monthly-signal-v2",
    start_month: options.startMonth,
    end_month: options.endMonth,
    status: "running",
    summary: {},
    completed_at: null,
  }, { onConflict: "id" });
  if (runError) throw runError;

  const rows: ModelReplayMonth[] = [];
  for (const month of months) {
    const row = await replayModelMonth(month);
    rows.push(row);
    const { error } = await supabase.from("model_replay_months").upsert({
      run_id: runId,
      month: row.month,
      as_of_date: row.asOfDate,
      baseline_signals: row.baselineSignals,
      candidate_signals: row.candidateSignals,
      metrics: row.metrics,
    }, { onConflict: "run_id,month" });
    if (error) throw error;
  }

  const summary = buildRunSummary(rows);
  const { error: completeError } = await supabase
    .from("model_replay_runs")
    .update({
      status: "completed",
      summary,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (completeError) throw completeError;

  return { runId, summary, rows };
}

export async function getLatestModelReplay(runId?: string) {
  const supabase = getSupabaseAdmin();
  let runQuery = supabase
    .from("model_replay_runs")
    .select("id, candidate_model_version, baseline_model_version, start_month, end_month, status, summary, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (runId) runQuery = runQuery.eq("id", runId);

  const { data: runs, error: runError } = await runQuery.returns<Array<{
    id: string;
    candidate_model_version: string;
    baseline_model_version: string;
    start_month: string;
    end_month: string;
    status: string;
    summary: Record<string, unknown>;
    created_at: string;
    completed_at: string | null;
  }>>();
  if (runError) throw runError;
  const run = runs?.[0];
  if (!run) return null;

  const { data: months, error: monthError } = await supabase
    .from("model_replay_months")
    .select("run_id, month, as_of_date, baseline_signals, candidate_signals, metrics")
    .eq("run_id", run.id)
    .order("month", { ascending: true })
    .returns<Array<{
      run_id: string;
      month: string;
      as_of_date: string;
      baseline_signals: ReplaySignal[];
      candidate_signals: ReplaySignal[];
      metrics: ReplayMonthMetrics;
    }>>();
  if (monthError) throw monthError;

  return {
    id: run.id,
    candidateModelVersion: run.candidate_model_version,
    baselineModelVersion: run.baseline_model_version,
    startMonth: run.start_month,
    endMonth: run.end_month,
    status: run.status,
    summary: run.summary,
    createdAt: run.created_at,
    completedAt: run.completed_at,
    months: (months ?? []).map((item) => ({
      month: item.month,
      asOfDate: item.as_of_date,
      baselineSignals: item.baseline_signals,
      candidateSignals: item.candidate_signals,
      metrics: item.metrics,
    })),
  };
}
