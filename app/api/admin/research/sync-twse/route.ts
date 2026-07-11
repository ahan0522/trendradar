import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { syncTwseResearchData } from "@/lib/research-data/twse";

type RequestBody = {
  dryRun?: boolean;
  includeActions?: boolean;
  includePrices?: boolean;
  includeIndices?: boolean;
  indexDate?: string;
};

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const result = await syncTwseResearchData({
      dryRun: body.dryRun ?? true,
      includeActions: body.includeActions ?? true,
      includePrices: body.includePrices ?? true,
      includeIndices: body.includeIndices ?? true,
      indexDate: body.indexDate,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown TWSE sync error";
    const migrationRequired = /relation .* does not exist|column .* does not exist/i.test(message);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        migrationRequired,
      },
      { status: migrationRequired ? 409 : 400 },
    );
  }
}
