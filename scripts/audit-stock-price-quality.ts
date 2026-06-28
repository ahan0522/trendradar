import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { assessLatestPrice } from "@/lib/signals/price-quality";
import type { MarketCode } from "@/types/signals";

loadEnvConfig(process.cwd());

type PriceRow = {
  symbol: string;
  market: MarketCode;
  price_date: string;
  close: number;
  adj_close: number | null;
  volume: number | null;
  provider: string | null;
  source_url: string | null;
  fetched_at: string | null;
  quality_status: string;
  verification_provider: string | null;
};

async function main() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("stock_prices")
    .select("symbol, market, price_date, close, adj_close, volume, provider, source_url, fetched_at, quality_status, verification_provider")
    .eq("quality_status", "verified")
    .neq("market", "TW")
    .limit(10000)
    .returns<PriceRow[]>();
  if (error) throw error;

  const downgraded = (data ?? []).filter((row) => {
    return assessLatestPrice(row.symbol, row.market, {
      priceDate: row.price_date,
      close: Number(row.close),
      adjClose: row.adj_close === null ? null : Number(row.adj_close),
      volume: row.volume === null ? null : Number(row.volume),
      qualityStatus: row.quality_status,
      provider: row.provider,
      sourceUrl: row.source_url,
    }).status !== "verified";
  });

  if (downgraded.length > 0) {
    const rows = downgraded.map((row) => ({
      symbol: row.symbol,
      market: row.market,
      price_date: row.price_date,
      close: row.close,
      adj_close: row.adj_close,
      volume: row.volume,
      provider: row.provider,
      source_url: row.source_url,
      fetched_at: row.fetched_at,
      quality_status: "needs_review",
      verification_provider: row.verification_provider,
      updated_at: new Date().toISOString(),
    }));
    const { error: upsertError } = await supabase
      .from("stock_prices")
      .upsert(rows, { onConflict: "symbol,market,price_date" });
    if (upsertError) throw upsertError;
  }

  console.log(JSON.stringify({
    checked: data?.length ?? 0,
    downgraded: downgraded.length,
    samples: downgraded.slice(0, 10).map((row) => ({
      symbol: row.symbol,
      market: row.market,
      priceDate: row.price_date,
      provider: row.provider,
      verificationProvider: row.verification_provider,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
