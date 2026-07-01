import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { SIGNAL_BACKTEST_HORIZONS } from "@/lib/signals/backtest";
import { backfillVerifiedReplayPrices } from "@/lib/signals/model-replay-price-backfill";
import { runModelReplayBacktestForSymbols } from "@/lib/signals/model-replay-backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const horizons = Array.isArray(body.horizons)
      ? body.horizons.map(Number).filter((value: number) =>
          SIGNAL_BACKTEST_HORIZONS.includes(value as (typeof SIGNAL_BACKTEST_HORIZONS)[number]))
      : [...SIGNAL_BACKTEST_HORIZONS];
    const excludedMarkets = Array.isArray(body.excludedMarkets)
      ? body.excludedMarkets.filter((market: unknown) =>
          market === "US" || market === "TW" || market === "KR" || market === "JP" || market === "GLOBAL")
      : [];
    const prices = await backfillVerifiedReplayPrices({
      runId: typeof body.runId === "string" ? body.runId : undefined,
      maxSymbols: Number.isFinite(Number(body.maxSymbols)) ? Number(body.maxSymbols) : 2,
      horizons: horizons.length > 0 ? horizons : [...SIGNAL_BACKTEST_HORIZONS],
      dryRun: body.dryRun !== false,
      excludedMarkets,
    });
    const backtest = body.dryRun === false
      ? await runModelReplayBacktestForSymbols(
          prices.runId,
          prices.selectedSymbols.map((item) => item.symbol),
        )
      : null;
    return NextResponse.json({ ok: true, prices, backtest });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Replay price backfill failed",
    }, { status: 400 });
  }
}
