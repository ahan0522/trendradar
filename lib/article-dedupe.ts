import { getCanonicalSourceName } from "@/lib/source-scoring";
import type { SourceKind } from "@/types/news";

export type DedupeArticleInput = {
  title: string;
  description?: string | null;
  sourceName?: string | null;
  sourceKind?: SourceKind;
  link?: string | null;
  publishedAt?: string | null;
};

function normalizeComparableText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[|｜].*$/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getComparableText(article: DedupeArticleInput) {
  return normalizeComparableText(`${article.title} ${article.description ?? ""}`);
}

function getTokenSimilarity(left: string, right: string) {
  const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean));

  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token));
  const union = new Set([...leftTokens, ...rightTokens]);

  return intersection.length / union.size;
}

function getCharacterSimilarity(left: string, right: string) {
  const leftChars = new Set(left.replace(/\s+/g, "").split(""));
  const rightChars = new Set(right.replace(/\s+/g, "").split(""));

  if (leftChars.size === 0 || rightChars.size === 0) return 0;

  const intersection = [...leftChars].filter((char) => rightChars.has(char));
  const smallerSize = Math.min(leftChars.size, rightChars.size);

  return intersection.length / smallerSize;
}

function getTextSimilarity(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);

  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  return Math.max(
    getTokenSimilarity(normalizedLeft, normalizedRight),
    getCharacterSimilarity(normalizedLeft, normalizedRight)
  );
}

function getPublishedTime(article: DedupeArticleInput) {
  if (!article.publishedAt) return 0;

  const time = new Date(article.publishedAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isLikelySameNewsEvent(
  left: DedupeArticleInput,
  right: DedupeArticleInput
) {
  if (left.link && right.link && left.link === right.link) return true;

  const leftSource = getCanonicalSourceName({
    sourceName: left.sourceName ?? undefined,
    sourceKind: left.sourceKind,
  });
  const rightSource = getCanonicalSourceName({
    sourceName: right.sourceName ?? undefined,
    sourceKind: right.sourceKind,
  });
  const sameCanonicalSource = leftSource === rightSource;
  const titleSimilarity = getTextSimilarity(left.title, right.title);
  const bodySimilarity = getTextSimilarity(
    getComparableText(left),
    getComparableText(right)
  );

  if (sameCanonicalSource && titleSimilarity >= 0.58) return true;
  if (sameCanonicalSource && bodySimilarity >= 0.68) return true;
  if (titleSimilarity >= 0.82) return true;
  if (bodySimilarity >= 0.86) return true;

  return false;
}

function getRepresentative<T extends DedupeArticleInput>(articles: T[]) {
  return [...articles].sort(
    (left, right) => getPublishedTime(right) - getPublishedTime(left)
  )[0];
}

export function dedupeArticlesByEvent<T extends DedupeArticleInput>(
  articles: T[]
) {
  const groups: T[][] = [];

  articles.forEach((article) => {
    const group = groups.find((items) =>
      items.some((item) => isLikelySameNewsEvent(article, item))
    );

    if (group) {
      group.push(article);
      return;
    }

    groups.push([article]);
  });

  return groups
    .map(getRepresentative)
    .sort((left, right) => getPublishedTime(right) - getPublishedTime(left));
}
