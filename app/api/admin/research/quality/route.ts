import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { getResearchDataQualityReport } from "@/lib/research-data/quality-report";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  return NextResponse.json(await getResearchDataQualityReport());
}
