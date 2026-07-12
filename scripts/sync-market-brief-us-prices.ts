import { loadEnvConfig } from "@next/env";
import { syncMarketBriefUsPrices } from "@/lib/reports/market-brief-price-sync";

loadEnvConfig(process.cwd());

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function currentNewYorkDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const today = currentNewYorkDate();
  const result = await syncMarketBriefUsPrices({
    startDate: argument("start") ?? today,
    endDate: argument("end") ?? argument("start") ?? today,
    dryRun: process.argv.includes("--dry-run"),
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
