import { NextRequest, NextResponse } from "next/server";
import { runModelReplayBacktest } from "@/lib/signals/model-replay-backtest";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runModelReplayBacktest(
      typeof body.runId === "string" && body.runId ? body.runId : undefined,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Model replay backtest failed",
    }, { status: 500 });
  }
}
