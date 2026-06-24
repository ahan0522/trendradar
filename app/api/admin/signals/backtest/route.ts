import { NextRequest, NextResponse } from "next/server";
import { runBacktestForAllSignals, runBacktestForSignal } from "@/lib/signals/backtest";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { signalEventId?: string };
    const result = body.signalEventId ? await runBacktestForSignal(body.signalEventId) : await runBacktestForAllSignals();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
