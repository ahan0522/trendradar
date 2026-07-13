import { getSupabaseAdmin } from "@/lib/supabase-server";
import { fetchTwseMarginTradingBalance } from "@/lib/research-data/twse";

export async function syncTwMarginTradingBalance(options?: { dryRun?: boolean }) {
  const dryRun = options?.dryRun ?? true;
  const balance = await fetchTwseMarginTradingBalance();

  if (!balance) {
    return { ok: true, dryRun, balanceFound: false, reason: "今日無融資融券餘額資料（非交易日或尚未公布）。" };
  }
  if (dryRun) {
    return { ok: true, dryRun: true, balanceFound: true, balance };
  }

  const { error } = await getSupabaseAdmin()
    .from("tw_margin_trading_balance")
    .upsert(
      {
        trade_date: balance.tradeDate,
        margin_balance_lots: balance.marginBalanceLots,
        margin_balance_change_lots: balance.marginBalanceChangeLots,
        margin_balance_amount_thousand: balance.marginBalanceAmountThousand,
        margin_balance_change_amount_thousand: balance.marginBalanceChangeAmountThousand,
        short_balance_lots: balance.shortBalanceLots,
        short_balance_change_lots: balance.shortBalanceChangeLots,
        provider: "twse-official",
        source_url: balance.sourceUrl,
        fetched_at: balance.fetchedAt,
        quality_status: "verified",
        verified_at: balance.fetchedAt,
        verification_provider: "twse-official",
        updated_at: balance.fetchedAt,
      },
      { onConflict: "trade_date" },
    );
  if (error) throw error;
  return { ok: true, dryRun: false, balanceFound: true, tradeDate: balance.tradeDate };
}
