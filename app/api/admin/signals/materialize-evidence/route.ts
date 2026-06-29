import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { materializeSignalResearchEvidence } from "@/lib/signals/evidence-materialization";

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;
  try {
    const body = (await request.json().catch(() => ({}))) as { signalEventId?: string };
    return NextResponse.json(await materializeSignalResearchEvidence(body.signalEventId));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to materialize evidence" },
      { status: 500 },
    );
  }
}
