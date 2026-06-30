import { NextRequest, NextResponse } from "next/server";
import { getLatestModelReplay } from "@/lib/signals/model-replay";
import { getModelReplayBacktestResults } from "@/lib/signals/model-replay-backtest";
import { buildReplayResearchReport } from "@/lib/signals/replay-research-report";

export async function GET(request: NextRequest) {
  try {
    const runId = request.nextUrl.searchParams.get("runId") ?? undefined;
    const report = await getLatestModelReplay(runId);
    const backtest = report ? await getModelReplayBacktestResults(report.id) : null;
    const researchReport = report && backtest ? buildReplayResearchReport(report, backtest) : null;
    return NextResponse.json({ ok: true, report, backtest, researchReport });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to load model comparison",
    }, { status: 500 });
  }
}
