import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { verifyHistoricalArticleTime } from "@/lib/historical-news/time-verification";
import {
  buildWaybackCdxUrl,
  buildWaybackSnapshotUrl,
  parseHistoricalPageMetadata,
  parseWaybackFirstCapture,
  titleSimilarity,
} from "@/lib/historical-news/source-evidence";

loadEnvConfig(process.cwd());

type HistoricalArticleRow = {
  id: string;
  title: string;
  published_at: string | null;
  created_at: string | null;
};

function argument(name: string) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TrendRadar/1.0 Historical Source Verification",
      Accept: "text/html,application/xhtml+xml,application/json;q=0.9",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
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
  const parsedOriginalUrl = new URL(originalUrl);
  if (!/^https?:$/.test(parsedOriginalUrl.protocol) || /(^|\.)google\./i.test(parsedOriginalUrl.hostname)) {
    throw new Error("original-url must be a non-Google HTTP(S) publisher URL.");
  }

  const supabase = getSupabaseAdmin();
  const { data: article, error: articleError } = await supabase
    .from("articles")
    .select("id, title, published_at, created_at")
    .eq("id", articleId)
    .single<HistoricalArticleRow>();
  if (articleError || !article) throw articleError ?? new Error("Article not found.");
  if (!article.id.startsWith("historical-backfill-")) {
    throw new Error("Only historical-backfill articles can use this verifier.");
  }

  const cdxPayload = JSON.parse(await fetchText(buildWaybackCdxUrl(originalUrl))) as unknown;
  const capture = parseWaybackFirstCapture(cdxPayload, originalUrl);
  if (!capture) throw new Error("No matching successful Internet Archive capture was found.");

  const archivedHtml = await fetchText(buildWaybackSnapshotUrl(capture));
  const metadata = parseHistoricalPageMetadata(archivedHtml);
  if (!metadata.title || !metadata.publishedAt) {
    throw new Error("The earliest archive snapshot lacks a usable title or publication timestamp.");
  }
  const similarity = titleSimilarity(article.title, metadata.title);
  if (similarity < 0.72) {
    throw new Error(`Archived title similarity ${similarity} is below the 0.72 verification gate.`);
  }

  const result = verifyHistoricalArticleTime({
    articleId: article.id,
    title: article.title,
    claimedPublishedAt: article.published_at,
    createdAt: article.created_at,
    originalPagePublishedAt: metadata.publishedAt,
    archiveFirstSeenAt: capture.capturedAt,
    originalUrl,
  });
  if (result.status !== "verified") {
    throw new Error(`Independent evidence did not verify the article: ${result.status}`);
  }

  let written = 0;
  if (write) {
    const { data, error } = await supabase
      .from("article_time_verifications")
      .upsert({
        article_id: result.articleId,
        claimed_published_at: result.claimedPublishedAt,
        verified_published_at: result.verifiedPublishedAt,
        available_at: result.availableAt,
        verification_status: result.status,
        verification_method: result.method,
        evidence: [
          ...result.evidence,
          {
            type: "archive_snapshot_metadata",
            snapshot_url: buildWaybackSnapshotUrl(capture),
            title_similarity: similarity,
            published_at_method: metadata.publishedAtMethod,
          },
        ],
        verifier_version: result.verifierVersion,
      }, {
        onConflict: "article_id,verifier_version",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw error;
    written = data?.length ?? 0;
  }

  console.log(JSON.stringify({
    mode: write ? "write" : "dry-run",
    written,
    articleId,
    originalUrl,
    archiveFirstSeenAt: capture.capturedAt,
    archivedPublishedAt: metadata.publishedAt,
    archivedTitle: metadata.title,
    titleSimilarity: similarity,
    verification: result,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
