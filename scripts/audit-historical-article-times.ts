import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { verifyHistoricalArticleTime } from "@/lib/historical-news/time-verification";

loadEnvConfig(process.cwd());

type HistoricalArticleRow = {
  id: string;
  title: string;
  published_at: string | null;
  created_at: string | null;
};

async function main() {
  const write = process.argv.includes("--write");
  const limitArg = process.argv.find((value) => value.startsWith("--limit="));
  const limit = Math.min(Math.max(Number(limitArg?.split("=")[1] ?? 500), 1), 10000);
  const supabase = getSupabaseAdmin();
  const articles: HistoricalArticleRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < limit; offset += pageSize) {
    const pageLimit = Math.min(pageSize, limit - offset);
    const { data, error } = await supabase
      .from("articles")
      .select("id, title, published_at, created_at")
      .like("id", "historical-backfill-%")
      .order("published_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageLimit - 1)
      .returns<HistoricalArticleRow[]>();
    if (error) throw error;
    articles.push(...(data ?? []));
    if ((data ?? []).length < pageLimit) break;
  }

  const results = articles.map((article) =>
    verifyHistoricalArticleTime({
      articleId: article.id,
      title: article.title,
      claimedPublishedAt: article.published_at,
      createdAt: article.created_at,
    })
  );
  const counts = results.reduce<Record<string, number>>((accumulator, result) => {
    accumulator[result.status] = (accumulator[result.status] ?? 0) + 1;
    return accumulator;
  }, {});

  let written = 0;
  let writeBatches = 0;
  if (write && results.length > 0) {
    const writeBatchSize = 500;
    for (let offset = 0; offset < results.length; offset += writeBatchSize) {
      const batch = results.slice(offset, offset + writeBatchSize);
      const { data: upserted, error: upsertError } = await supabase
        .from("article_time_verifications")
        .upsert(batch.map((result) => ({
          article_id: result.articleId,
          claimed_published_at: result.claimedPublishedAt,
          verified_published_at: result.verifiedPublishedAt,
          available_at: result.availableAt,
          verification_status: result.status,
          verification_method: result.method,
          evidence: result.evidence,
          verifier_version: result.verifierVersion,
        })), {
          onConflict: "article_id,verifier_version",
          ignoreDuplicates: true,
        })
        .select("id");
      if (upsertError) {
        throw new Error(
          `Verification write failed for rows ${offset + 1}-${offset + batch.length}: ${upsertError.message}`,
        );
      }
      written += upserted?.length ?? 0;
      writeBatches += 1;
    }
  }

  console.log(JSON.stringify({
    mode: write ? "write" : "dry-run",
    checked: results.length,
    written,
    writeBatches,
    counts,
    conflicts: results.filter((result) => result.status === "conflict").slice(0, 10),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
