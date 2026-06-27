import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { syncFredResearchData } from "@/lib/research-data/fred";

type RequestBody = {
  startDate?: string;
  seriesIds?: string[];
  dryRun?: boolean;
};

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    return NextResponse.json(await syncFredResearchData({
      startDate: body.startDate,
      seriesIds: body.seriesIds,
      dryRun: body.dryRun ?? true,
    }));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown FRED sync error" },
      { status: 400 },
    );
  }
}
