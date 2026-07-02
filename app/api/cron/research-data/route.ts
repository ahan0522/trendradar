import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getResearchDataQualityReport } from "@/lib/research-data/quality-report";
import { syncFredResearchData } from "@/lib/research-data/fred";
import { syncSecResearchData } from "@/lib/research-data/sec-edgar";
import { syncTwseResearchData } from "@/lib/research-data/twse";
import { syncTpexResearchData } from "@/lib/research-data/tpex";
import { finalizeMonthlySignals, previousMonthEnd } from "@/lib/signals/monthly-ledger";
import { generateSignalLedger } from "@/lib/signals/generate-ledger";
import { runDailyBacktestUpdate } from "@/lib/signals/backtest";
import { createMissingPublicationDrafts } from "@/lib/signals/publication-review";
import { materializeSignalResearchEvidence } from "@/lib/signals/evidence-materialization";
import { recalculateResearchConfidenceSnapshots } from "@/lib/signals/research-confidence-assessment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type WatchlistSymbol = {
  symbol: string;
  market: string;
};

async function getUsWatchlistSymbols() {
  const { data } = await getSupabaseAdmin()
    .from("signal_watchlists")
    .select("symbol, market")
    .eq("market", "US")
    .limit(8)
    .returns<WatchlistSymbol[]>();
  return [...new Set((data ?? []).map((item) => item.symbol))];
}

function currentTaipeiDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    day: "2-digit",
  }).format(new Date());
}

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type SyncResult =
  | { status: "success"; data: unknown; durationMs?: number }
  | { status: "skipped"; reason: string; durationMs?: number }
  | { status: "failed"; error: string; durationMs?: number };

async function runSync(task: () => Promise<unknown>): Promise<SyncResult> {
  const startedAt = Date.now();
  try {
    return { status: "success", data: await task(), durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown source sync error",
      durationMs: Date.now() - startedAt,
    };
  }
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
    const [twse, tpex, sec, fred] = await Promise.all([
      runSync(() => syncTwseResearchData({ dryRun: false })),
      runSync(() => syncTpexResearchData({ dryRun: false })),
      runSync(() => syncSecResearchData({
        dryRun: false,
        symbols: usSymbols.length > 0 ? usSymbols : undefined,
      })),
      runSync(() => syncFredResearchData({
        dryRun: false,
        startDate: new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10),
        apiKey: process.env.FRED_API_KEY?.trim(),
        allowCsvFallback: true,
      })),
    ]);
    const qualityAfter = await getResearchDataQualityReport();
    const today = currentTaipeiDate();
    const signalLedger = await runSync(() => generateSignalLedger(today));
    const researchEvidence = await runSync(async () => {
      if (signalLedger.status !== "success") {
        throw new Error("Signal Ledger generation failed; evidence materialization was skipped.");
      }
      const ledger = signalLedger.data as { signals?: Array<{ id: string }> };
      const results = [];
      for (const signal of ledger.signals ?? []) {
        results.push(await materializeSignalResearchEvidence(signal.id));
      }
      return results;
    });
    const researchConfidence = researchEvidence.status === "success"
      ? await runSync(() => recalculateResearchConfidenceSnapshots(today))
      : { status: "skipped" as const, reason: "Evidence materialization did not complete." };
    const backtests = await runSync(() => runDailyBacktestUpdate(5));
    const publicationDrafts = await runSync(() => createMissingPublicationDrafts(5));
    const replayValidation = {
      status: "skipped" as const,
      reason: "Historical replay runs through the dedicated admin endpoint, outside the daily ingestion budget.",
    };
    const finalizedMonth = currentTaipeiDay() === "01"
      ? await finalizeMonthlySignals(previousMonthEnd())
      : null;

    return NextResponse.json({
      ok: [twse, tpex, sec, fred].some((result) => result.status === "success"),
      degraded: [twse, tpex, sec, fred].some((result) => result.status !== "success"),
      mode: "daily-research-data",
      durationMs: Date.now() - startedAt,
      twse,
      tpex,
      sec,
      fred,
      quality: qualityAfter,
      signalLedger,
      researchEvidence,
      researchConfidence,
      backtests,
      publicationDrafts,
      replayValidation,
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
