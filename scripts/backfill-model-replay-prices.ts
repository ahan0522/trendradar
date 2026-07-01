import { loadEnvConfig } from "@next/env";
import { backfillVerifiedReplayPrices } from "@/lib/signals/model-replay-price-backfill";

loadEnvConfig(process.cwd());

async function main() {
  const maxSymbols = Number(process.argv[2] ?? 8);
  const result = await backfillVerifiedReplayPrices({
    maxSymbols,
    horizons: [7, 30, 60, 90],
  });
  console.log(JSON.stringify({
    runId: result.runId,
    dryRun: result.dryRun,
    selectedSymbols: result.selectedSymbols,
    requestCount: result.requestCount,
    fetched: result.fetched,
    upserted: result.upserted,
    skippedSummary: result.skippedSummary,
    skippedSample: result.skipped.slice(0, 20),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
