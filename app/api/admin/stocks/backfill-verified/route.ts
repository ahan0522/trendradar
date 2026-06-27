import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { backfillVerifiedTwsePrices } from "@/lib/signals/verified-price-backfill";

type RequestBody = {
  signalEventId?: string;
  signalLimit?: number;
  dryRun?: boolean;
};

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    return NextResponse.json(await backfillVerifiedTwsePrices({
      signalEventId: body.signalEventId,
      signalLimit: body.signalLimit,
      dryRun: body.dryRun ?? true,
    }));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown verified price backfill error" },
      { status: 400 },
    );
  }
}
