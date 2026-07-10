import { NextRequest, NextResponse } from "next/server";
import { getMarketBrief } from "@/lib/reports/market-brief";
import type { MarketBriefPeriod } from "@/types/market-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const periods = new Set<MarketBriefPeriod>(["daily", "weekly", "monthly"]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") ?? "daily";
  if (!periods.has(periodParam as MarketBriefPeriod)) {
    return NextResponse.json(
      { ok: false, error: "period must be daily, weekly, or monthly" },
      { status: 400 },
    );
  }

  try {
    const brief = await getMarketBrief({
      period: periodParam as MarketBriefPeriod,
      asOfDate: searchParams.get("asOfDate") ?? undefined,
    });
    return NextResponse.json(brief);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown market brief error",
      },
      { status: 500 },
    );
  }
}
