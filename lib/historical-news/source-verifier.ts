import { getSupabaseAdmin } from "@/lib/supabase-server";
import { verifyHistoricalArticleTime } from "@/lib/historical-news/time-verification";
import {
  buildWaybackCdxUrl,
  buildWaybackSnapshotUrl,
  parseHistoricalPageMetadata,
  parseWaybackFirstCapture,
  titleSimilarity,
} from "@/lib/historical-news/source-evidence";

type HistoricalArticleRow = {
  id: string;
  title: string;
  published_at: string | null;
  created_at: string | null;
};

async function fetchText(url: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "TrendRadar/1.0 Historical Source Verification",
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9",
      },
      cache: "no-store",
    });
    if (response.ok) return response.text();
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 3) {
      throw new Error(`${url} returned ${response.status} after ${attempt} attempt(s)`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  throw new Error(`${url} failed without a response`);
}

export async function verifyHistoricalArticleSource(input: {
  articleId: string;
  originalUrl: string;
  write?: boolean;
}) {
  const parsedOriginalUrl = new URL(input.originalUrl);
  if (
    !/^https?:$/.test(parsedOriginalUrl.protocol) ||
    /(^|\.)google\./i.test(parsedOriginalUrl.hostname)
  ) {
    throw new Error("originalUrl must be a non-Google HTTP(S) publisher URL.");
  }

  const supabase = getSupabaseAdmin();
  const { data: article, error: articleError } = await supabase
    .from("articles")
    .select("id, title, published_at, created_at")
    .eq("id", input.articleId)
    .single<HistoricalArticleRow>();
  if (articleError || !article) throw articleError ?? new Error("Article not found.");
  if (!article.id.startsWith("historical-backfill-")) {
    throw new Error("Only historical-backfill articles can use this verifier.");
  }

  const cdxPayload = JSON.parse(
    await fetchText(buildWaybackCdxUrl(input.originalUrl)),
  ) as unknown;
  const capture = parseWaybackFirstCapture(cdxPayload, input.originalUrl);
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
    originalUrl: input.originalUrl,
  });
  if (result.status !== "verified") {
    throw new Error(`Independent evidence did not verify the article: ${result.status}`);
  }

  const evidence = [
    ...result.evidence,
    {
      type: "archive_snapshot_metadata",
      snapshot_url: buildWaybackSnapshotUrl(capture),
      title_similarity: similarity,
      published_at_method: metadata.publishedAtMethod,
    },
  ];
  let written = 0;
  if (input.write) {
    const { data, error } = await supabase
      .from("article_time_verifications")
      .upsert({
        article_id: result.articleId,
        claimed_published_at: result.claimedPublishedAt,
        verified_published_at: result.verifiedPublishedAt,
        available_at: result.availableAt,
        verification_status: result.status,
        verification_method: result.method,
        evidence,
        verifier_version: result.verifierVersion,
      }, {
        onConflict: "article_id,verifier_version",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw error;
    written = data?.length ?? 0;
  }

  return {
    mode: input.write ? "write" as const : "dry-run" as const,
    written,
    articleId: input.articleId,
    originalUrl: input.originalUrl,
    archiveFirstSeenAt: capture.capturedAt,
    archivedPublishedAt: metadata.publishedAt,
    archivedTitle: metadata.title,
    titleSimilarity: similarity,
    verification: result,
    evidence,
  };
}
