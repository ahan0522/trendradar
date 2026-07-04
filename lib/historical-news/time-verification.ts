export const ARTICLE_TIME_VERIFIER_VERSION = "article-time-v1";

export type ArticleTimeVerificationInput = {
  articleId: string;
  title: string;
  claimedPublishedAt: string | null;
  createdAt: string | null;
  originalPagePublishedAt?: string | null;
  archiveFirstSeenAt?: string | null;
  originalUrl?: string | null;
};

export type ArticleTimeVerificationResult = {
  articleId: string;
  status: "verified" | "conflict" | "unverifiable";
  claimedPublishedAt: string | null;
  verifiedPublishedAt: string | null;
  availableAt: string | null;
  method: string;
  evidence: Array<Record<string, unknown>>;
  verifierVersion: string;
};

function validIso(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function editionMonthFromTitle(title: string) {
  const matches = [...title.matchAll(/(20\d{2})\s*年\s*(0?[1-9]|1[0-2])\s*月/g)];
  return matches.at(-1)
    ? `${matches.at(-1)?.[1]}-${String(matches.at(-1)?.[2]).padStart(2, "0")}`
    : null;
}

function daysApart(left: string, right: string) {
  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) / 86400000;
}

export function verifyHistoricalArticleTime(
  input: ArticleTimeVerificationInput,
): ArticleTimeVerificationResult {
  const claimed = validIso(input.claimedPublishedAt);
  const created = validIso(input.createdAt);
  const original = validIso(input.originalPagePublishedAt);
  const archived = validIso(input.archiveFirstSeenAt);
  const evidence: Array<Record<string, unknown>> = [];

  const editionMonth = editionMonthFromTitle(input.title);
  const claimedMonth = claimed?.slice(0, 7) ?? null;
  if (editionMonth && claimedMonth && editionMonth > claimedMonth) {
    evidence.push({
      type: "title_edition_date_conflict",
      editionMonth,
      claimedMonth,
      title: input.title,
    });
    return {
      articleId: input.articleId,
      status: "conflict",
      claimedPublishedAt: claimed,
      verifiedPublishedAt: null,
      availableAt: created,
      method: "title-edition-conflict",
      evidence,
      verifierVersion: ARTICLE_TIME_VERIFIER_VERSION,
    };
  }

  if (claimed && original && archived && daysApart(claimed, original) <= 2) {
    evidence.push({
      type: "original_page_date",
      value: original,
      url: input.originalUrl ?? null,
    });
    evidence.push({
      type: "archive_first_seen",
      value: archived,
      url: input.originalUrl ?? null,
    });
    return {
      articleId: input.articleId,
      status: "verified",
      claimedPublishedAt: claimed,
      verifiedPublishedAt: original,
      availableAt: archived,
      method: "original-page-plus-archive",
      evidence,
      verifierVersion: ARTICLE_TIME_VERIFIER_VERSION,
    };
  }

  if (claimed && archived && new Date(archived) >= new Date(claimed)) {
    evidence.push({
      type: "archive_first_seen",
      value: archived,
      url: input.originalUrl ?? null,
    });
    return {
      articleId: input.articleId,
      status: "verified",
      claimedPublishedAt: claimed,
      verifiedPublishedAt: claimed,
      availableAt: archived,
      method: "archive-existence-proof",
      evidence,
      verifierVersion: ARTICLE_TIME_VERIFIER_VERSION,
    };
  }

  if (original) {
    evidence.push({
      type: "original_page_date_unconfirmed",
      value: original,
      url: input.originalUrl ?? null,
    });
  }

  return {
    articleId: input.articleId,
    status: "unverifiable",
    claimedPublishedAt: claimed,
    verifiedPublishedAt: null,
    availableAt: created,
    method: "insufficient-independent-evidence",
    evidence,
    verifierVersion: ARTICLE_TIME_VERIFIER_VERSION,
  };
}
