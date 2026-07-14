import { getSupabaseAdmin } from "@/lib/supabase-server";

const USD_TWD_YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/TWD=X?range=5d&interval=1d";

export type UsdTwdRate = {
  tradeDate: string;
  rate: number;
  changeAmount: number | null;
  changePct: number | null;
  sourceUrl: string;
  fetchedAt: string;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
  };
};

function isoDateFromUnixSeconds(seconds: number) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

// FX trades continuously (no clean daily-close boundary like equities), so
// this takes the last two non-null closes in the recent-day series as
// "current" and "prior" rather than looking for a specific market-close
// timestamp. Single Yahoo-chart source only -- shown as provisional/
// descriptive context, same honesty tier as the US indices this codebase
// already labels "單一來源".
export async function fetchUsdTwdRate(): Promise<UsdTwdRate | null> {
  const fetchedAt = new Date().toISOString();
  const response = await fetch(USD_TWD_YAHOO_URL, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "TrendRadar/1.0 research-data@trendradar",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Yahoo chart request failed: ${response.status}`);
  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  if (timestamps.length === 0 || closes.length === 0) return null;

  const points = timestamps
    .map((timestamp, index) => ({ timestamp, close: closes[index] }))
    .filter((point): point is { timestamp: number; close: number } => typeof point.close === "number");
  if (points.length === 0) return null;

  const latest = points[points.length - 1];
  const prior = points.length > 1 ? points[points.length - 2] : null;
  const changeAmount = prior ? Number((latest.close - prior.close).toFixed(4)) : null;
  const changePct = prior && prior.close !== 0
    ? Number((((latest.close - prior.close) / prior.close) * 100).toFixed(3))
    : null;

  return {
    tradeDate: isoDateFromUnixSeconds(latest.timestamp),
    rate: Number(latest.close.toFixed(4)),
    changeAmount,
    changePct,
    sourceUrl: USD_TWD_YAHOO_URL,
    fetchedAt,
  };
}

export async function syncUsdTwdRate(options?: { dryRun?: boolean }) {
  const dryRun = options?.dryRun ?? true;
  const rate = await fetchUsdTwdRate();

  if (!rate) return { ok: true, dryRun, rateFound: false, reason: "無法取得 USD/TWD 匯率資料。" };
  if (dryRun) return { ok: true, dryRun: true, rateFound: true, rate };

  const { error } = await getSupabaseAdmin()
    .from("tw_fx_rates")
    .upsert(
      {
        trade_date: rate.tradeDate,
        pair: "USD/TWD",
        rate: rate.rate,
        change_amount: rate.changeAmount,
        change_pct: rate.changePct,
        provider: "yahoo-chart",
        source_url: rate.sourceUrl,
        fetched_at: rate.fetchedAt,
        quality_status: "unverified",
        updated_at: rate.fetchedAt,
      },
      { onConflict: "trade_date,pair" },
    );
  if (error) throw error;
  return { ok: true, dryRun: false, rateFound: true, tradeDate: rate.tradeDate };
}
