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

export function normalizeComparableText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[|｜].*$/g, " ")
    .replace(/\s+[-–—]\s+[^-–—]{1,60}$/u, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArticleUrl(value?: string | null) {
  if (!value) return "";

  try {
    const url = new URL(value);
    url.hash = "";
    const trackingKeys = new Set([
      "fbclid",
      "gclid",
      "ref",
      "ref_src",
      "source",
    ]);
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || trackingKeys.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function getArticleEventFingerprint(article: DedupeArticleInput) {
  const normalizedTitle = normalizeComparableText(article.title).replace(/\s+/g, "");
  if (normalizedTitle) return `title:${normalizedTitle}`;

  const normalizedUrl = normalizeArticleUrl(article.link);
  return normalizedUrl ? `url:${normalizedUrl}` : "";
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
  const leftUrl = normalizeArticleUrl(left.link);
  const rightUrl = normalizeArticleUrl(right.link);
  if (leftUrl && rightUrl && leftUrl === rightUrl) return true;

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
  const exactItems = new Map<string, T>();
  const withoutFingerprint: T[] = [];

  for (const article of articles) {
    const fingerprint = getArticleEventFingerprint(article);
    if (!fingerprint) {
      withoutFingerprint.push(article);
      continue;
    }
    const current = exactItems.get(fingerprint);
    exactItems.set(
      fingerprint,
      current ? getRepresentative([current, article]) : article
    );
  }

  const groups: T[][] = [];

  [...exactItems.values(), ...withoutFingerprint].forEach((article) => {
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

function getTaipeiDate(value?: string | null) {
  if (!value) return "unknown";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "unknown";
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function dedupeArticlesByEventWindow<T extends DedupeArticleInput>(
  articles: T[]
) {
  const dailyBuckets = new Map<string, T[]>();
  for (const article of articles) {
    const date = getTaipeiDate(article.publishedAt);
    const bucket = dailyBuckets.get(date) ?? [];
    bucket.push(article);
    dailyBuckets.set(date, bucket);
  }

  return [...dailyBuckets.values()]
    .flatMap((bucket) => dedupeArticlesByEvent(bucket))
    .sort((left, right) => getPublishedTime(right) - getPublishedTime(left));
}

export function dedupeArticlesByFingerprintWindow<T extends DedupeArticleInput>(
  articles: T[]
) {
  const representatives = new Map<string, T>();
  for (const article of articles) {
    const fingerprint =
      getArticleEventFingerprint(article) ||
      normalizeArticleUrl(article.link) ||
      `${article.title}:${article.publishedAt ?? ""}`;
    const key = `${getTaipeiDate(article.publishedAt)}:${fingerprint}`;
    const current = representatives.get(key);
    representatives.set(
      key,
      current ? getRepresentative([current, article]) : article
    );
  }

  return [...representatives.values()].sort(
    (left, right) => getPublishedTime(right) - getPublishedTime(left)
  );
}
