import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { fetchValidatedStockPriceOnOrBefore } from "@/lib/signals/price-fetcher";
import { upsertStockPrices } from "@/lib/signals/stock-prices";
import type { StockPrice } from "@/types/signals";

loadEnvConfig(process.cwd());

type PendingPriceRow = {
  symbol: string;
  price_date: string;
};

async function main() {
  const write = process.argv.includes("--write");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("stock_prices")
    .select("symbol, price_date")
    .eq("market", "TW")
    .eq("quality_status", "needs_review")
    .order("price_date", { ascending: true })
    .returns<PendingPriceRow[]>();

  if (error) throw error;

  const verified: StockPrice[] = [];
  const blocked: Array<{ symbol: string; priceDate: string; errors: string[] }> = [];

  for (const row of data ?? []) {
    const result = await fetchValidatedStockPriceOnOrBefore(
      { symbol: row.symbol, market: "TW", date: row.price_date },
      0,
    );
    if (result.status === "fetched" && result.price?.priceDate === row.price_date) {
      verified.push(result.price);
      continue;
    }
    blocked.push({
      symbol: row.symbol,
      priceDate: row.price_date,
      errors: result.errors.length > 0 ? result.errors : ["Exact-date cross-source verification unavailable."],
    });
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
