import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { finalizeMonthlySignals, previousMonthEnd } from "@/lib/signals/monthly-ledger";

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as { asOfDate?: string };
    return NextResponse.json(await finalizeMonthlySignals(body.asOfDate ?? previousMonthEnd()));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown month finalization error" },
      { status: 400 },
    );
  }
}
