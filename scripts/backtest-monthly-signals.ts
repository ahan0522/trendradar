import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { runBacktestForSignal } from "@/lib/signals/backtest";

loadEnvConfig(process.cwd());

type OutcomeKey = "success" | "partial" | "failed" | "pending";

async function main() {
  const supabase = getSupabaseAdmin();
  const signalIds = process.argv.slice(2).filter((value) => !value.startsWith("--"));
  let query = supabase
    .from("signal_events")
    .select("id, signal_date")
    .like("id", "monthly-%")
    .order("signal_date", { ascending: true });
  if (signalIds.length > 0) {
    query = query.in("id", signalIds);
  }
  const { data, error } = await query
    .returns<Array<{ id: string; signal_date: string }>>();
  if (error) throw error;

  const summary = {
    signals: 0,
    outcomes: 0,
    success: 0,
    partial: 0,
    failed: 0,
    pending: 0,
  };

  for (const signal of data ?? []) {
    const results = await runBacktestForSignal(signal.id);
    summary.signals += 1;
    summary.outcomes += results.length;
    for (const result of results) summary[result.outcome as OutcomeKey] += 1;
    console.log(JSON.stringify({
      signalEventId: signal.id,
      signalDate: signal.signal_date,
      outcomes: results.map((item) => ({
        horizonDays: item.horizonDays,
        outcome: item.outcome,
        basketReturn: item.basketReturn,
        excessReturn: item.excessReturn,
      })),
    }));
  }

  console.log(JSON.stringify({ summary }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
