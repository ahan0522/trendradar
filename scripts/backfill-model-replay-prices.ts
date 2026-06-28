import { loadEnvConfig } from "@next/env";
import { backfillVerifiedReplayPrices } from "@/lib/signals/model-replay-price-backfill";

loadEnvConfig(process.cwd());

async function main() {
  const maxSymbols = Number(process.argv[2] ?? 8);
  const result = await backfillVerifiedReplayPrices({
    maxSymbols,
    horizons: [30],
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
