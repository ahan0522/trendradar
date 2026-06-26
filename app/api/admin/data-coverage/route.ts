import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { getDataCoverage } from "@/lib/signals/data-coverage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const startMonth = searchParams.get("startMonth") ?? undefined;
  const endMonth = searchParams.get("endMonth") ?? undefined;

  try {
    const coverage = await getDataCoverage({ startMonth, endMonth });
    return NextResponse.json(coverage);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load data coverage.",
      },
      { status: 500 },
    );
  }
}
