import { loadEnvConfig } from "@next/env";
import { runModelReplayRange } from "@/lib/signals/model-replay";

loadEnvConfig(process.cwd());

async function main() {
  const startMonth = process.argv[2] ?? "2025-01";
  const endMonth = process.argv[3] ?? "2026-04";
  const result = await runModelReplayRange({ startMonth, endMonth });
  console.log(JSON.stringify({
    runId: result.runId,
    summary: result.summary,
    months: result.rows.map((row) => ({
      month: row.month,
      baseline: row.metrics.baselineFamilies,
      candidate: row.metrics.candidateFamilies,
      newFamilies: row.metrics.newlyDiscoveredFamilies,
      overlap: row.metrics.familyOverlapRate,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

