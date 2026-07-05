import { loadEnvConfig } from "@next/env";
import { verifyHistoricalArticleSource } from "@/lib/historical-news/source-verifier";

loadEnvConfig(process.cwd());

function argument(name: string) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function main() {
  const articleId = argument("article-id");
  const originalUrl = argument("original-url");
  const write = process.argv.includes("--write");
  if (!articleId || !originalUrl) {
    throw new Error(
      "Usage: --article-id=<historical article id> --original-url=<publisher URL> [--write]",
    );
  }
  console.log(JSON.stringify(await verifyHistoricalArticleSource({
    articleId,
    originalUrl,
    write,
  }), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
