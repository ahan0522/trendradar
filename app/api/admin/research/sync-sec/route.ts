import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { syncSecResearchData } from "@/lib/research-data/sec-edgar";

type RequestBody = {
  symbols?: string[];
  since?: string;
  limitPerCompany?: number;
  dryRun?: boolean;
};

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const result = await syncSecResearchData({
      symbols: body.symbols,
      since: body.since,
      limitPerCompany: body.limitPerCompany,
      dryRun: body.dryRun ?? true,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SEC sync error";
    const migrationRequired = /relation .* does not exist|column .* does not exist/i.test(message);
    return NextResponse.json(
      { ok: false, error: message, migrationRequired },
      { status: migrationRequired ? 409 : 400 },
    );
  }
}
