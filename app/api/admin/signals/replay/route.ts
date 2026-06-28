import { NextRequest, NextResponse } from "next/server";
import { runModelReplayRange } from "@/lib/signals/model-replay";

function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const startMonth = body.startMonth ?? "2025-01";
    const endMonth = body.endMonth ?? startMonth;
    if (!isValidMonth(startMonth) || !isValidMonth(endMonth) || startMonth > endMonth) {
      return NextResponse.json({ ok: false, error: "startMonth/endMonth must use YYYY-MM and form a valid range" }, { status: 400 });
    }

    const result = await runModelReplayRange({ startMonth, endMonth });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Model replay failed",
    }, { status: 500 });
  }
}

