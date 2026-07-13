import { loadEnvConfig } from "@next/env";
import { backfillTwseInstitutionalValueFlow } from "@/lib/research-data/institutional-value-flow";

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
  const today = currentTaipeiDate();
  const result = await backfillTwseInstitutionalValueFlow({
    startDate: argument("start") ?? today,
    endDate: argument("end") ?? argument("start") ?? today,
    dryRun: !process.argv.includes("--write"),
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
