export type ArticleTimeInput = {
  id: string;
  sourceId?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  verificationStatus?: "verified" | "conflict" | "unverifiable" | null;
  verifiedAvailableAt?: string | null;
};

function isValidTimestamp(value: string | null | undefined) {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()));
}

export function isHistoricalBackfillArticle(article: Pick<ArticleTimeInput, "id" | "sourceId">) {
  return article.id.startsWith("historical-backfill-") ||
    article.sourceId?.startsWith("historical-") === true;
}

export function getResearchAvailableAt(article: ArticleTimeInput) {
  if (isHistoricalBackfillArticle(article)) {
    if (
      article.verificationStatus === "verified" &&
      isValidTimestamp(article.verifiedAvailableAt)
    ) {
      return article.verifiedAvailableAt as string;
    }
    return isValidTimestamp(article.createdAt) ? article.createdAt as string : null;
  }
  if (isValidTimestamp(article.createdAt)) return article.createdAt as string;
  return isValidTimestamp(article.publishedAt) ? article.publishedAt as string : null;
}

export function getResearchEffectivePublishedAt(article: ArticleTimeInput, asOfDate: string) {
  const availableAt = getResearchAvailableAt(article);
  if (!availableAt) return null;
  const asOfEnd = new Date(`${asOfDate}T23:59:59.999+08:00`).getTime();
  return new Date(availableAt).getTime() <= asOfEnd ? availableAt : null;
}
