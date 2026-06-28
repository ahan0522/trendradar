import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { runModelReplayBacktest } from "@/lib/signals/model-replay-backtest";

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

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
