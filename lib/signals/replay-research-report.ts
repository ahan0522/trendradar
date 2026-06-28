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
};

function round(value: number) {
  return Number(value.toFixed(2));
}

function toResearchCase(result: ReplaySignalResult): ReplayResearchCase | null {
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
  };
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

  const cases = backtest.results
    .map(toResearchCase)
    .filter((item): item is ReplayResearchCase => item !== null);
  const candidateCases = cases.filter((item) => item.modelVersion === replay.candidateModelVersion);
  const strongestCases = [...candidateCases].sort((a, b) => b.excessReturn - a.excessReturn).slice(0, 3);
  const failedCases = [...candidateCases].filter((item) => item.excessReturn < 0)
    .sort((a, b) => a.excessReturn - b.excessReturn)
    .slice(0, 3);
  const coverageLift = Number(replay.summary.coverageBreadthLift ?? 0);

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
  };
}
