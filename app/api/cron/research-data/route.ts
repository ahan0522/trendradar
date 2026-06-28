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
import { backfillVerifiedReplayPrices } from "@/lib/signals/model-replay-price-backfill";
import { runModelReplayBacktestForSymbols } from "@/lib/signals/model-replay-backtest";

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

function currentTaipeiWeekday() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    weekday: "short",
  }).format(new Date());
}

type SyncResult =
  | { status: "success"; data: unknown }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

async function runSync(task: () => Promise<unknown>): Promise<SyncResult> {
  try {
    return { status: "success", data: await task() };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown source sync error",
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
    const fredApiKey = process.env.FRED_API_KEY?.trim();
    const [twse, tpex, sec, fred] = await Promise.all([
      runSync(() => syncTwseResearchData({ dryRun: false })),
      runSync(() => syncTpexResearchData({ dryRun: false })),
      runSync(() => syncSecResearchData({
        dryRun: false,
        symbols: usSymbols.length > 0 ? usSymbols : undefined,
      })),
      fredApiKey
        ? runSync(() => syncFredResearchData({
            dryRun: false,
            startDate: new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10),
            apiKey: fredApiKey,
            allowCsvFallback: false,
          }))
        : Promise.resolve<SyncResult>({
            status: "skipped",
            reason: "FRED_API_KEY is not configured; TWSE and SEC ingestion continued.",
          }),
    ]);
    const qualityAfter = await getResearchDataQualityReport();
    const signalLedger = await runSync(() => generateSignalLedger(currentTaipeiDate()));
    const backtests = await runSync(() => runDailyBacktestUpdate());
    const replayValidation = currentTaipeiWeekday() === "Sun"
      ? await runSync(async () => {
          const prices = await backfillVerifiedReplayPrices({
            maxSymbols: 1,
            horizons: [30, 60, 90],
            dryRun: false,
            excludedSymbols: ["1519.TW", "MU", "000660.KS", "005930.KS", "2408.TW"],
          });
          const backtest = await runModelReplayBacktestForSymbols(
            prices.runId,
            prices.selectedSymbols.map((item) => item.symbol),
          );
          return { prices, backtest };
        })
      : { status: "skipped" as const, reason: "Replay validation runs on Sunday (Asia/Taipei)." };
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
      backtests,
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
