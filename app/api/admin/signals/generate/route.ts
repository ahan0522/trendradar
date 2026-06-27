import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { generateSignalLedger } from "@/lib/signals/generate-ledger";
import { getResearchDataQualityReport } from "@/lib/research-data/quality-report";

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const quality = await getResearchDataQualityReport();
    if (quality.migrationRequired.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          migrationRequired: true,
          missingTables: quality.migrationRequired,
          error: "Research database migration must be applied before generating Signal Ledger rows.",
        },
        { status: 503 },
      );
    }
    const body = (await request.json()) as { asOfDate?: string };
    const asOfDate = body.asOfDate ?? new Date().toISOString().slice(0, 10);
    return NextResponse.json(await generateSignalLedger(asOfDate));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
