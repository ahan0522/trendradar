import { loadEnvConfig } from "@next/env";
import { runModelReplayBacktest } from "@/lib/signals/model-replay-backtest";

loadEnvConfig(process.cwd());

const runId = process.argv[2];

async function main() {
  const result = await runModelReplayBacktest(runId);
  console.log(JSON.stringify({
    runId: result.runId,
    summary: result.summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
