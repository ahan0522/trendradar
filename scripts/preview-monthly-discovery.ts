import { loadEnvConfig } from "@next/env";
import { getMonthlyDiscoverySignals } from "@/lib/signals/monthly-discovery";

loadEnvConfig(process.cwd());

async function main() {
  const dates = process.argv.slice(2);
  if (dates.length === 0) dates.push("2025-01-31", "2025-06-30", "2026-04-30");

  for (const asOfDate of dates) {
    const signals = await getMonthlyDiscoverySignals(asOfDate);
    console.log(JSON.stringify({
      asOfDate,
      signalCount: signals.length,
      signals: signals.map((signal) => {
        const evidence = signal.evidence[0] as Record<string, unknown>;
        return {
          topic: signal.topic,
          strength: signal.signalStrength,
          confidence: signal.confidenceScore,
          category: evidence.category,
          heatState: evidence.heat_state,
          articles: evidence.article_count,
          sources: evidence.source_count,
          watchlists: signal.watchlistCount,
          samples: evidence.sample_titles,
        };
      }),
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
