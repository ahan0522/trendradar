import { NextRequest, NextResponse } from "next/server";
import { getLatestModelReplay } from "@/lib/signals/model-replay";
import { getModelReplayBacktestResults } from "@/lib/signals/model-replay-backtest";

export async function GET(request: NextRequest) {
  try {
    const runId = request.nextUrl.searchParams.get("runId") ?? undefined;
    const report = await getLatestModelReplay(runId);
    const backtest = report ? await getModelReplayBacktestResults(report.id) : null;
    return NextResponse.json({ ok: true, report, backtest });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to load model comparison",
    }, { status: 500 });
  }
}
