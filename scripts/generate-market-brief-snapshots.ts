import { loadEnvConfig } from "@next/env";
import { getMarketBrief } from "@/lib/reports/market-brief";
import { persistMarketBriefSnapshot } from "@/lib/reports/market-brief-snapshots";
import type { MarketBriefPeriod } from "@/types/market-report";

loadEnvConfig(process.cwd());

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const asOfDate = argument("date") ?? currentTaipeiDate();
  const requested = argument("period") ?? "daily,weekly";
  const periods = requested.split(",")
    .map((item) => item.trim())
    .filter((item): item is MarketBriefPeriod => ["daily", "weekly", "monthly"].includes(item));
  if (periods.length === 0) throw new Error("--period must include daily, weekly, or monthly.");

  const results = [];
  for (const period of periods) {
    const brief = await getMarketBrief({ period, asOfDate });
    results.push(await persistMarketBriefSnapshot(brief));
  }
  console.log(JSON.stringify({ ok: true, asOfDate, periods, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
