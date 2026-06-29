import { NextResponse } from "next/server";
import { getMonthlySignalReport } from "@/lib/signals/monthly-signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startMonth = searchParams.get("startMonth") ?? undefined;
  const endMonth = searchParams.get("endMonth") ?? undefined;
  const today = searchParams.get("today") ?? undefined;
  const includeCandidates = searchParams.get("includeCandidates") === "true";

  try {
    const report = await getMonthlySignalReport({
      startMonth,
      endMonth,
      today,
      includeCandidates,
    });
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown monthly signal report error",
        rows: [],
      },
      { status: 500 },
    );
  }
}
