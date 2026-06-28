import { loadEnvConfig } from "@next/env";
import { finalizeMonthlySignals } from "@/lib/signals/monthly-ledger";

loadEnvConfig(process.cwd());

function monthEnd(month: string) {
  const value = new Date(`${month}-01T00:00:00.000Z`);
  value.setUTCMonth(value.getUTCMonth() + 1);
  value.setUTCDate(0);
  return value.toISOString().slice(0, 10);
}

function monthsBetween(startMonth: string, endMonth: string) {
  const rows: string[] = [];
  const cursor = new Date(`${startMonth}-01T00:00:00.000Z`);
  const end = new Date(`${endMonth}-01T00:00:00.000Z`);
  while (cursor <= end) {
    rows.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return rows;
}

async function main() {
  const startMonth = process.argv[2] ?? "2025-01";
  const endMonth = process.argv[3] ?? startMonth;
  if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) {
    throw new Error("Usage: tsx scripts/finalize-monthly-range.ts YYYY-MM [YYYY-MM]");
  }

  for (const month of monthsBetween(startMonth, endMonth)) {
    const result = await finalizeMonthlySignals(monthEnd(month));
    console.log(JSON.stringify(result));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
