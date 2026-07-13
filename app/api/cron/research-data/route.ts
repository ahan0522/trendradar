import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getResearchDataQualityReport } from "@/lib/research-data/quality-report";
import { syncFredResearchData } from "@/lib/research-data/fred";
import { syncSecResearchData } from "@/lib/research-data/sec-edgar";
import { syncSecCompanyFacts } from "@/lib/research-data/sec-company-facts";
import { syncEiaGridDemand } from "@/lib/research-data/eia-grid-demand";
import { syncMicronInvestorData } from "@/lib/research-data/micron-investor";
import { syncNvidiaSecData } from "@/lib/research-data/nvidia-sec";
import { syncTwseResearchData } from "@/lib/research-data/twse";
import { syncTpexResearchData } from "@/lib/research-data/tpex";
import { syncTaifexResearchData } from "@/lib/research-data/taifex";
import { syncTwInstitutionalValueFlow } from "@/lib/research-data/institutional-value-flow";
import { finalizeMonthlySignals, previousMonthEnd } from "@/lib/signals/monthly-ledger";
import { generateSignalLedger } from "@/lib/signals/generate-ledger";
import {
  CURRENT_BACKTEST_MODEL_VERSIONS,
  runDailyBacktestUpdate,
} from "@/lib/signals/backtest";
import { backfillVerifiedSignalPrices } from "@/lib/signals/verified-price-backfill";
import { createMissingPublicationDrafts } from "@/lib/signals/publication-review";
import { materializeCurrentModelResearchEvidence } from "@/lib/signals/evidence-materialization";
import { recalculateResearchConfidenceSnapshots } from "@/lib/signals/research-confidence-assessment";
import { LIVE_COLLECTION_POLICY, signalDataModeForDate } from "@/lib/signals/live-collection-policy";
import { syncMarketBriefUsPrices } from "@/lib/reports/market-brief-price-sync";
import { getMarketBrief } from "@/lib/reports/market-brief";
import { persistMarketBriefSnapshot } from "@/lib/reports/market-brief-snapshots";
import type { MarketBrief } from "@/types/market-report";

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
  | { status: "success"; data: unknown; durationMs?: number; attempts?: number }
  | { status: "skipped"; reason: string; durationMs?: number; attempts?: number }
  | { status: "failed"; error: string; durationMs?: number; attempts?: number };

async function runSync(task: () => Promise<unknown>, retries = 0): Promise<SyncResult> {
  const startedAt = Date.now();
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      return {
        status: "success",
        data: await task(),
        durationMs: Date.now() - startedAt,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
    }
  }
  return {
    status: "failed",
    error: lastError instanceof Error ? lastError.message : "Unknown source sync error",
    durationMs: Date.now() - startedAt,
    attempts: retries + 1,
  };
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
    const [twse, tpex, taifex, twInstitutionalValue, sec, secFacts, micron, nvidia, fred, eia] = await Promise.all([
      runSync(() => syncTwseResearchData({ dryRun: false }), 1),
      runSync(() => syncTpexResearchData({ dryRun: false }), 1),
      runSync(() => syncTaifexResearchData({ dryRun: false }), 1),
      runSync(() => syncTwInstitutionalValueFlow({ dryRun: false }), 1),
      runSync(() => syncSecResearchData({
        dryRun: false,
        symbols: usSymbols.length > 0 ? usSymbols : undefined,
      }), 1),
      runSync(() => syncSecCompanyFacts({
        dryRun: false,
        symbols: ["MU", "MSFT", "GOOGL", "META", "AMZN", "GEV", "ETN", "VRT"],
      }), 1),
      runSync(() => syncMicronInvestorData({ dryRun: false }), 1),
      runSync(() => syncNvidiaSecData({ dryRun: false }), 1),
      runSync(() => syncFredResearchData({
        dryRun: false,
        startDate: new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10),
        apiKey: process.env.FRED_API_KEY?.trim(),
        allowCsvFallback: true,
      }), 1),
      process.env.EIA_API_KEY?.trim()
        ? runSync(() => syncEiaGridDemand({ dryRun: false }), 1)
        : Promise.resolve({
            status: "skipped" as const,
            reason: "EIA_API_KEY is not configured.",
          }),
    ]);
    const qualityAfter = await getResearchDataQualityReport();
    const today = currentTaipeiDate();
    const marketBriefUsPrices = await runSync(() => syncMarketBriefUsPrices({
      startDate: today,
      dryRun: false,
    }));
    const signalLedger = await runSync(() => generateSignalLedger(today));
    const researchEvidence = await runSync(async () => {
      if (signalLedger.status !== "success") {
        throw new Error("Signal Ledger generation failed; evidence materialization was skipped.");
      }
      return materializeCurrentModelResearchEvidence(CURRENT_BACKTEST_MODEL_VERSIONS);
    });
    const researchConfidence = researchEvidence.status === "success"
      ? await runSync(async () => {
          const materialized = researchEvidence.data as { asOfDates?: string[] };
          const results = [];
          for (const asOfDate of materialized.asOfDates ?? [today]) {
            results.push(await recalculateResearchConfidenceSnapshots(asOfDate));
          }
          return results;
        })
      : { status: "skipped" as const, reason: "Evidence materialization did not complete." };
    const verifiedPriceBackfill = await runSync(() => backfillVerifiedSignalPrices({
      modelVersions: [...CURRENT_BACKTEST_MODEL_VERSIONS],
      signalLimit: 5,
      dryRun: false,
    }));
    const backtests = await runSync(() => runDailyBacktestUpdate(5));
    const publicationDrafts = await runSync(() => createMissingPublicationDrafts(5));
    const dailyMarketBrief = await runSync(() => getMarketBrief({
      period: "daily",
      asOfDate: today,
    }));
    const weeklyMarketBrief = ["Sat", "Sun"].includes(currentTaipeiWeekday())
      ? await runSync(() => getMarketBrief({ period: "weekly", asOfDate: today }))
      : { status: "skipped" as const, reason: "Weekly market brief is generated on weekends." };
    const dailyMarketBriefSnapshot = dailyMarketBrief.status === "success"
      ? await runSync(() => persistMarketBriefSnapshot(dailyMarketBrief.data as MarketBrief))
      : { status: "skipped" as const, reason: "Daily market brief generation did not complete." };
    const weeklyMarketBriefSnapshot = weeklyMarketBrief.status === "success"
      ? await runSync(() => persistMarketBriefSnapshot(weeklyMarketBrief.data as MarketBrief))
      : { status: "skipped" as const, reason: "Weekly market brief was not generated in this run." };
    const replayValidation = {
      status: "skipped" as const,
      reason: "Historical replay runs through the dedicated admin endpoint, outside the daily ingestion budget.",
    };
    const finalizedMonth = currentTaipeiDay() === "01"
      ? await finalizeMonthlySignals(previousMonthEnd())
      : null;

    return NextResponse.json({
      ok: [twse, tpex, taifex, twInstitutionalValue, sec, secFacts, micron, nvidia, fred].some((result) => result.status === "success"),
      degraded: [twse, tpex, taifex, twInstitutionalValue, sec, secFacts, micron, nvidia, fred].some((result) => result.status !== "success"),
      mode: "daily-research-data",
      collectionPolicy: {
        ...LIVE_COLLECTION_POLICY,
        todayDataMode: signalDataModeForDate(today),
        historicalBackfillUse: "audit-only",
      },
      durationMs: Date.now() - startedAt,
      twse,
      tpex,
      taifex,
      twInstitutionalValue,
      sec,
      secFacts,
      micron,
      nvidia,
      fred,
      eia,
      marketBriefUsPrices,
      quality: qualityAfter,
      signalLedger,
      researchEvidence,
      researchConfidence,
      verifiedPriceBackfill,
      backtests,
      publicationDrafts,
      dailyMarketBrief,
      weeklyMarketBrief,
      dailyMarketBriefSnapshot,
      weeklyMarketBriefSnapshot,
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
