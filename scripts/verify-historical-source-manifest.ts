import { loadEnvConfig } from "@next/env";
import { historicalSourceManifest } from "@/data/historical-source-manifest";
import { verifyHistoricalArticleSource } from "@/lib/historical-news/source-verifier";

loadEnvConfig(process.cwd());

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

async function main() {
  const write = process.argv.includes("--write");
  const limitArg = process.argv.find((value) => value.startsWith("--limit="));
  const limit = Math.min(
    Math.max(Number(limitArg?.split("=")[1] ?? historicalSourceManifest.length), 1),
    historicalSourceManifest.length,
  );
  const results: Array<Record<string, unknown>> = [];

  for (const entry of historicalSourceManifest.slice(0, limit)) {
    try {
      const result = await verifyHistoricalArticleSource({
        articleId: entry.articleId,
        originalUrl: entry.originalUrl,
        write,
      });
      results.push({
        articleId: entry.articleId,
        status: "verified",
        resolutionMethod: entry.resolutionMethod,
        resolvedAt: entry.resolvedAt,
        result,
      });
    } catch (error) {
      results.push({
        articleId: entry.articleId,
        status: "failed",
        resolutionMethod: entry.resolutionMethod,
        resolvedAt: entry.resolvedAt,
        error: describeError(error),
      });
    }
  }

  console.log(JSON.stringify({
    mode: write ? "write" : "dry-run",
    manifestEntries: historicalSourceManifest.length,
    processed: results.length,
    verified: results.filter((row) => row.status === "verified").length,
    failed: results.filter((row) => row.status === "failed").length,
    results,
  }, null, 2));

  if (results.some((row) => row.status === "failed")) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
