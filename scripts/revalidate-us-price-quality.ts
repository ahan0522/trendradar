import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { assessLatestPrice } from "@/lib/signals/price-quality";
import { upsertStockPrices } from "@/lib/signals/stock-prices";
import {
  crossVerifyUsPrice,
  fetchAlphaVantageDailySeries,
} from "@/lib/signals/us-price-verification";
import type { StockPrice } from "@/types/signals";

loadEnvConfig(process.cwd());

type PendingPriceRow = {
  symbol: string;
  price_date: string;
  close: number;
  adj_close: number | null;
  volume: number | null;
  provider: string | null;
  source_url: string | null;
  fetched_at: string | null;
  quality_status: "needs_review";
  verification_provider: string | null;
};

async function main() {
  const write = process.argv.includes("--write");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("stock_prices")
    .select("symbol, price_date, close, adj_close, volume, provider, source_url, fetched_at, quality_status, verification_provider")
    .eq("market", "US")
    .eq("quality_status", "needs_review")
    .order("symbol")
    .order("price_date")
    .returns<PendingPriceRow[]>();

  if (error) throw error;

  const rowsBySymbol = new Map<string, PendingPriceRow[]>();
  for (const row of data ?? []) {
    rowsBySymbol.set(row.symbol, [...(rowsBySymbol.get(row.symbol) ?? []), row]);
  }

  const verified: StockPrice[] = [];
  const blocked: Array<{ symbol: string; priceDate?: string; reason: string }> = [];

  for (const [symbol, rows] of rowsBySymbol) {
    const independent = await fetchAlphaVantageDailySeries(symbol);
    if (independent.error) {
      blocked.push({ symbol, reason: independent.error });
      continue;
    }

    for (const row of rows) {
      const yahooPrice: StockPrice = {
        symbol: row.symbol,
        market: "US",
        priceDate: row.price_date,
        close: Number(row.close),
        ...(row.adj_close === null ? {} : { adjClose: Number(row.adj_close) }),
        ...(row.volume === null ? {} : { volume: Number(row.volume) }),
        ...(row.provider ? { provider: row.provider } : {}),
        ...(row.source_url ? { sourceUrl: row.source_url } : {}),
        ...(row.fetched_at ? { fetchedAt: row.fetched_at } : {}),
        qualityStatus: row.quality_status,
        ...(row.verification_provider ? { verificationProvider: row.verification_provider } : {}),
      };
      const secondSource = independent.prices.get(row.price_date);
      const combined = secondSource ? crossVerifyUsPrice(yahooPrice, secondSource) : null;
      const quality = combined
        ? assessLatestPrice(row.symbol, "US", {
            priceDate: combined.priceDate,
            close: combined.close,
            adjClose: combined.adjClose ?? null,
            volume: combined.volume ?? null,
            qualityStatus: combined.qualityStatus,
            provider: combined.provider,
            sourceUrl: combined.sourceUrl,
            verificationProvider: combined.verificationProvider,
          })
        : null;

      if (combined && quality?.status === "verified") {
        verified.push(combined);
      } else {
        blocked.push({
          symbol,
          priceDate: row.price_date,
          reason: secondSource
            ? quality?.reason ?? "Cross-source close difference exceeded 1%."
            : "Independent source has no exact-date close.",
        });
      }
    }
  }

  const upserted = write ? await upsertStockPrices(verified) : { count: 0 };
  console.log(JSON.stringify({
    mode: write ? "write" : "dry-run",
    checked: data?.length ?? 0,
    verified: verified.length,
    upserted: upserted.count,
    blocked,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
