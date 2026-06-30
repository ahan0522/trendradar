import type { ModelReplayMonth } from "@/lib/signals/model-replay";
import type { ReplaySignalResult } from "@/lib/signals/model-replay-backtest";

type ReplayRun = {
  id: string;
  startMonth: string;
  endMonth: string;
  baselineModelVersion: string;
  candidateModelVersion: string;
  summary: Record<string, unknown>;
  months: ModelReplayMonth[];
};

type ReplayBacktest = {
  summary: {
    signalCount: number;
    mappedCount: number;
    testedCount: number;
    unmappedCount: number;
    missingPriceCount: number;
    thirtyDayTestCount: number;
    baseline: ModelPerformance;
    candidate: ModelPerformance;
  };
  results: ReplaySignalResult[];
};

type ModelPerformance = {
  signalCount: number;
  mappedCount: number;
  testedCount: number;
  averageThirtyDayExcessReturn: number | null;
  thirtyDaySuccessRate: number | null;
};

export type ReplayResearchCase = {
  signalId: string;
  modelVersion: string;
  month: string;
  topic: string;
  family: string;
  watchlist: Array<{ symbol: string; companyName: string; market: string }>;
  basketReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  outcome: "success" | "partial" | "failed";
  strength: number | null;
  confidence: number | null;
};

function round(value: number) {
  return Number(value.toFixed(2));
}

function toResearchCase(
  result: ReplaySignalResult,
  signalMetrics: Map<string, { strength: number; confidence: number }>,
): ReplayResearchCase | null {
  const outcome = result.outcomes.find((item) => item.horizonDays === 30);
  if (
    !outcome ||
    outcome.basketReturn === null ||
    outcome.benchmarkReturn === null ||
    outcome.excessReturn === null ||
    outcome.outcome === "pending"
  ) return null;

  return {
    signalId: result.signalId,
    modelVersion: result.modelVersion,
    month: result.month,
    topic: result.topic,
    family: result.family,
    watchlist: result.watchlist.map((item) => ({
      symbol: item.symbol,
      companyName: item.companyName,
      market: item.market,
    })),
    basketReturn: round(outcome.basketReturn),
    benchmarkReturn: round(outcome.benchmarkReturn),
    excessReturn: round(outcome.excessReturn),
    outcome: outcome.outcome,
    strength: signalMetrics.get(`${result.modelVersion}|${result.signalId}`)?.strength ?? null,
    confidence: signalMetrics.get(`${result.modelVersion}|${result.signalId}`)?.confidence ?? null,
  };
}

function average(values: number[]) {
  return values.length === 0
    ? null
    : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function groupPerformance(
  cases: ReplayResearchCase[],
  keyFor: (item: ReplayResearchCase) => string,
) {
  const groups = new Map<string, ReplayResearchCase[]>();
  for (const item of cases) {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].map(([key, items]) => ({
    key,
    sampleCount: items.length,
    averageExcessReturn: average(items.map((item) => item.excessReturn)),
    successRate: round(items.filter((item) => item.outcome === "success").length / items.length),
    failureRate: round(items.filter((item) => item.outcome === "failed").length / items.length),
  })).sort((a, b) => b.sampleCount - a.sampleCount || Number(b.averageExcessReturn) - Number(a.averageExcessReturn));
}

function groupDataGapsByFamily(results: ReplaySignalResult[]) {
  const groups = new Map<string, ReplaySignalResult[]>();
  for (const result of results) {
    groups.set(result.family, [...(groups.get(result.family) ?? []), result]);
  }
  return [...groups.entries()].map(([family, items]) => {
    const missingSymbols = new Map<string, number>();
    for (const item of items) {
      for (const symbol of item.missingPrices) {
        missingSymbols.set(symbol, (missingSymbols.get(symbol) ?? 0) + 1);
      }
    }
    return {
      family,
      signalCount: items.length,
      testedCount: items.filter((item) => item.mappingStatus === "tested").length,
      unmappedCount: items.filter((item) => item.mappingStatus === "unmapped").length,
      missingPriceCount: items.filter((item) => item.mappingStatus === "missing_prices").length,
      pendingHorizonCount: items.filter((item) => item.mappingStatus === "pending_horizon").length,
      topMissingSymbols: [...missingSymbols.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 8)
        .map(([symbol, count]) => ({ symbol, count })),
    };
  }).sort((a, b) =>
    (b.missingPriceCount + b.unmappedCount + b.pendingHorizonCount) -
      (a.missingPriceCount + a.unmappedCount + a.pendingHorizonCount) ||
    b.signalCount - a.signalCount ||
    a.family.localeCompare(b.family),
  );
}

export function buildReplayResearchReport(replay: ReplayRun, backtest: ReplayBacktest) {
  const baseline = backtest.summary.baseline;
  const candidate = backtest.summary.candidate;
  const alphaDelta = candidate.averageThirtyDayExcessReturn !== null && baseline.averageThirtyDayExcessReturn !== null
    ? candidate.averageThirtyDayExcessReturn - baseline.averageThirtyDayExcessReturn
    : null;
  const successDelta = candidate.thirtyDaySuccessRate !== null && baseline.thirtyDaySuccessRate !== null
    ? candidate.thirtyDaySuccessRate - baseline.thirtyDaySuccessRate
    : null;
  const enoughSamples = Math.min(baseline.testedCount, candidate.testedCount) >= 20;

  let verdict: "candidate_outperforming" | "baseline_outperforming" | "comparable" | "insufficient_data" =
    "insufficient_data";
  if (enoughSamples && alphaDelta !== null && successDelta !== null) {
    if (alphaDelta >= 2 && successDelta >= 0.05) verdict = "candidate_outperforming";
    else if (alphaDelta <= -2 && successDelta <= -0.05) verdict = "baseline_outperforming";
    else verdict = "comparable";
  }

  const verdictText = verdict === "candidate_outperforming"
    ? "新版在目前樣本中同時提高超額報酬與成功率，但仍需更多月份持續驗證。"
    : verdict === "baseline_outperforming"
      ? "舊版在目前樣本中表現較佳，新版擴大覆蓋後需要調整篩選門檻。"
      : verdict === "comparable"
        ? "新版明顯擴大研究覆蓋，但目前 30 日績效與舊版相近，尚未證明預測能力更強。"
        : "目前完整樣本仍不足，先呈現觀察結果，不對模型優劣下結論。";

  const signalMetrics = new Map(
    replay.months.flatMap((month) => [...month.baselineSignals, ...month.candidateSignals])
      .map((signal) => [
        `${signal.modelVersion}|${signal.id}`,
        { strength: signal.strength, confidence: signal.confidence },
      ]),
  );
  const cases = backtest.results
    .map((result) => toResearchCase(result, signalMetrics))
    .filter((item): item is ReplayResearchCase => item !== null);
  const candidateCases = cases.filter((item) => item.modelVersion === replay.candidateModelVersion);
  const strongestCases = [...candidateCases].sort((a, b) => b.excessReturn - a.excessReturn).slice(0, 3);
  const failedCases = [...candidateCases].filter((item) => item.excessReturn < 0)
    .sort((a, b) => a.excessReturn - b.excessReturn)
    .slice(0, 3);
  const coverageLift = Number(replay.summary.coverageBreadthLift ?? 0);
  const familyPerformance = groupPerformance(candidateCases, (item) => item.family);
  const dataGapsByFamily = groupDataGapsByFamily(backtest.results);
  const heatCalibration = groupPerformance(candidateCases, (item) => {
    if (item.strength === null) return "unknown";
    if (item.strength >= 50) return "50+";
    if (item.strength >= 40) return "40-49";
    return "<40";
  });
  const confidenceCalibration = groupPerformance(candidateCases, (item) => {
    if (item.confidence === null) return "unknown";
    if (item.confidence >= 65) return "65+";
    if (item.confidence >= 55) return "55-64";
    return "<55";
  });
  const reliableFamilies = familyPerformance.filter((item) => item.sampleCount >= 3);
  const bestFamily = [...reliableFamilies].sort(
    (a, b) => Number(b.averageExcessReturn) - Number(a.averageExcessReturn),
  )[0];
  const weakestFamily = [...reliableFamilies].sort(
    (a, b) => Number(a.averageExcessReturn) - Number(b.averageExcessReturn),
  )[0];
  const highStrength = heatCalibration.find((item) => item.key === "50+");
  const middleStrength = heatCalibration.find((item) => item.key === "40-49");
  const highConfidence = confidenceCalibration.find((item) => item.key === "65+");
  const middleConfidence = confidenceCalibration.find((item) => item.key === "55-64");
  const recommendations: string[] = [];
  if (bestFamily) {
    recommendations.push(
      `${bestFamily.key} 在 ${bestFamily.sampleCount} 筆樣本中平均 Alpha 為 ${bestFamily.averageExcessReturn}%：可優先擴充證據鏈，但不能只因歷史報酬提高權重。`,
    );
  }
  if (weakestFamily && weakestFamily.averageExcessReturn !== null && weakestFamily.averageExcessReturn < 0) {
    recommendations.push(
      `${weakestFamily.key} 平均 Alpha 為 ${weakestFamily.averageExcessReturn}%：下一版需提高來源品質、持續性或公司活動門檻。`,
    );
  }
  if (
    highStrength?.averageExcessReturn !== null &&
    highStrength?.averageExcessReturn !== undefined &&
    middleStrength?.averageExcessReturn !== null &&
    middleStrength?.averageExcessReturn !== undefined &&
    highStrength.averageExcessReturn <= middleStrength.averageExcessReturn
  ) {
    recommendations.push("Heat 50+ 尚未明顯優於 Heat 40-49；Heat 只描述市場升溫程度，不應解讀為較高報酬機率。");
  }
  if (
    highConfidence?.sampleCount &&
    middleConfidence?.sampleCount &&
    highConfidence.sampleCount >= 5 &&
    middleConfidence.sampleCount >= 5
  ) {
    const successDelta = highConfidence.successRate - middleConfidence.successRate;
    recommendations.push(
      Math.abs(successDelta) < 0.05
        ? "高研究信心組與中研究信心組的成功率仍接近；需要加入公司行動與價格確認，才能提高信心分數的辨識力。"
        : `研究信心 65+ 的成功率較 55-64 組${successDelta > 0 ? "高" : "低"} ${Math.abs(successDelta * 100).toFixed(1)} 個百分點，先視為校準線索而非定論。`,
    );
  }
  if (backtest.summary.missingPriceCount > 0) {
    recommendations.push(`仍有 ${backtest.summary.missingPriceCount} 個訊號缺少完整驗證價格，模型調整前需避免把缺失樣本視為失敗。`);
  }

  return {
    generatedAt: new Date().toISOString(),
    runId: replay.id,
    period: `${replay.startMonth} 至 ${replay.endMonth}`,
    methodology: "每月只使用當月月底以前的資訊產生訊號；月底後價格只用於 30 日結果驗證。",
    verdict,
    verdictText,
    executiveSummary: `新版每月研究領域較舊版增加 ${Math.round(coverageLift * 100)}%，目前已有 ${backtest.summary.thirtyDayTestCount} 筆完整 30 日樣本。${verdictText}`,
    coverage: {
      baselineSignals: baseline.signalCount,
      candidateSignals: candidate.signalCount,
      coverageBreadthLift: coverageLift,
    },
    performance: {
      baseline,
      candidate,
      alphaDelta: alphaDelta === null ? null : round(alphaDelta),
      successRateDelta: successDelta === null ? null : round(successDelta),
    },
    dataQuality: {
      totalSignals: backtest.summary.signalCount,
      mappedSignals: backtest.summary.mappedCount,
      completeThirtyDaySamples: backtest.summary.thirtyDayTestCount,
      missingPriceSignals: backtest.summary.missingPriceCount,
      unmappedSignals: backtest.summary.unmappedCount,
      caveat: "缺價或無法合理映射公司的訊號不計入成功率；報酬結果不代表未來績效。",
    },
    strongestCases,
    failedCases,
    diagnostics: {
      familyPerformance,
      dataGapsByFamily,
      heatCalibration,
      confidenceCalibration,
      recommendations,
    },
  };
}
