import { NextRequest, NextResponse } from "next/server";
import { getLatestModelReplay } from "@/lib/signals/model-replay";

export async function GET(request: NextRequest) {
  try {
    const runId = request.nextUrl.searchParams.get("runId") ?? undefined;
    const report = await getLatestModelReplay(runId);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to load model comparison",
    }, { status: 500 });
  }
}
