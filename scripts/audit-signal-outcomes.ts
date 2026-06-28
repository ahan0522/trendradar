import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";

loadEnvConfig(process.cwd());

type OutcomeRow = {
  signal_event_id: string;
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: "success" | "partial" | "failed" | "pending";
  details: Array<{
    symbol?: string;
    entryDate?: string | null;
    exitDate?: string | null;
    returnPct?: number | null;
  }> | null;
};

async function main() {
  const { data, error } = await getSupabaseAdmin()
    .from("signal_outcomes")
    .select("signal_event_id, horizon_days, basket_return, benchmark_return, excess_return, outcome, details")
    .like("signal_event_id", "monthly-%")
    .returns<OutcomeRow[]>();
  if (error) throw error;

  const rows = data ?? [];
  const extremeReview = rows.filter((row) =>
    row.outcome !== "pending" &&
    (Math.abs(Number(row.basket_return)) > 100 ||
      Math.abs(Number(row.benchmark_return)) > 100 ||
      Math.abs(Number(row.excess_return)) > 100),
  );
  const implausible = rows.filter((row) =>
    row.outcome !== "pending" &&
    (Math.abs(Number(row.basket_return)) > 400 ||
      Math.abs(Number(row.benchmark_return)) > 400 ||
      Math.abs(Number(row.excess_return)) > 400 ||
      (row.details ?? []).some((item) => Math.abs(Number(item.returnPct ?? 0)) > 500)),
  );
  const incomplete = rows.filter((row) =>
    row.outcome !== "pending" &&
    (!Array.isArray(row.details) ||
      row.details.length === 0 ||
      row.details.some((item) =>
        !item.entryDate ||
        !item.exitDate ||
        item.returnPct === null ||
        item.returnPct === undefined)),
  );
  const reversedDates = rows.filter((row) =>
    Array.isArray(row.details) &&
    row.details.some((item) => item.entryDate && item.exitDate && item.entryDate > item.exitDate),
  );
  const counts = rows.reduce<Record<string, number>>((result, row) => {
    result[row.outcome] = (result[row.outcome] ?? 0) + 1;
    return result;
  }, {});
  const thirtyDay = rows.filter((row) => row.horizon_days === 30 && row.outcome !== "pending");

  console.log(JSON.stringify({
    ok: implausible.length === 0 && incomplete.length === 0 && reversedDates.length === 0,
    reviewRequired: extremeReview.length > 0,
    outcomeCount: rows.length,
    counts,
    thirtyDayValidated: thirtyDay.length,
    thirtyDaySuccessRate: thirtyDay.length > 0
      ? Number(((thirtyDay.filter((row) => row.outcome === "success").length / thirtyDay.length) * 100).toFixed(2))
      : null,
    extremeReview,
    implausible,
    incomplete,
    reversedDates,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
