import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getResearchDataQualityReport } from "@/lib/research-data/quality-report";
import { syncSecResearchData } from "@/lib/research-data/sec-edgar";
import { syncTwseResearchData } from "@/lib/research-data/twse";
import { finalizeMonthlySignals, previousMonthEnd } from "@/lib/signals/monthly-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type WatchlistSymbol = {
  symbol: string;
  market: string;
};

async function getUsWatchlistSymbols() {
  const { data } = await getSupabaseAdmin()
    .from("signal_watchlists")
    .select("symbol, market")
    .eq("market", "US")
    .limit(50)
    .returns<WatchlistSymbol[]>();
  return [...new Set((data ?? []).map((item) => item.symbol))];
}

function currentTaipeiDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  const startedAt = Date.now();
  try {
    const qualityBefore = await getResearchDataQualityReport();
    if (qualityBefore.migrationRequired.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          migrationRequired: true,
          missingTables: qualityBefore.migrationRequired,
          error: "Research data migration must be applied before scheduled ingestion.",
        },
        { status: 503 },
      );
    }

    const usSymbols = await getUsWatchlistSymbols();
    const [twse, sec] = await Promise.all([
      syncTwseResearchData({ dryRun: false }),
      syncSecResearchData({
        dryRun: false,
        symbols: usSymbols.length > 0 ? usSymbols : undefined,
      }),
    ]);
    const qualityAfter = await getResearchDataQualityReport();
    const finalizedMonth = currentTaipeiDay() === "01"
      ? await finalizeMonthlySignals(previousMonthEnd())
      : null;

    return NextResponse.json({
      ok: true,
      mode: "daily-research-data",
      durationMs: Date.now() - startedAt,
      twse,
      sec,
      quality: qualityAfter,
      finalizedMonth,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown research data sync error",
      },
      { status: 500 },
    );
  }
}
