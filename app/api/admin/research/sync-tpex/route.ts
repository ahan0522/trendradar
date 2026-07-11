import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { syncTpexResearchData } from "@/lib/research-data/tpex";

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      dryRun?: boolean;
      includePrices?: boolean;
      includeIndices?: boolean;
      indexDate?: string;
    };
    return NextResponse.json(await syncTpexResearchData({
      dryRun: body.dryRun ?? true,
      includePrices: body.includePrices,
      includeIndices: body.includeIndices,
      indexDate: body.indexDate,
    }));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown TPEx sync error" },
      { status: 400 },
    );
  }
}
