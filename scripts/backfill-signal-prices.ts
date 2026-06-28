import { loadEnvConfig } from "@next/env";
import { backfillVerifiedSignalPrices } from "@/lib/signals/verified-price-backfill";

loadEnvConfig(process.cwd());

async function main() {
  const signalEventId = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  const monthlyOnly = process.argv.includes("--monthly");
  const result = await backfillVerifiedSignalPrices({
    signalEventId: signalEventId && !signalEventId.startsWith("--") ? signalEventId : undefined,
    signalIdPrefix: monthlyOnly ? "monthly-" : undefined,
    signalLimit: signalEventId && !signalEventId.startsWith("--") ? 1 : 100,
    dryRun,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
