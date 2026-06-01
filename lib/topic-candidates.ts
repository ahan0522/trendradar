type NewsArticle = {
  id: string;
  title: string;
  description?: string;
  sourceName: string;
  category?: string;
  link?: string;
  publishedAt: string | null;
};

export type CandidateTopic = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  articleCount: number;
  sourceCount: number;
  heatScore: number;
  latestPublishedAt: string;
  articles: Array<{
    id: string;
    title: string;
    sourceName: string;
    category: string;
    link: string;
    publishedAt: string | null;
  }>;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "新聞",
  "報導",
  "最新",
  "更多",
  "前往",
  "瀏覽",
  "頭條",
  "觀點",
  "google",
  "news",
  "yahoo",
  "udn",
  "com",
  "www",
  "https",
  "http",
  "cnyes",
  "setn",
  "ettoday",
  "ftnn",
  "msn",
  "line",
  "today",
  "自由",
  "自由體育",
  "自由財經",
  "中央社",
  "中時",
  "工商時報",
  "三立",
  "民視",
  "公視",
  "鏡新聞",
  "新聞網",
  "新聞雲",
  "台灣",
  "全球",
  "國際",
  "體育",
  "財經",
  "科技",
  "娛樂",
]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[a-z0-9-]+\.(com|tw|org|net|io|ai)\b/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function tokenize(value: string) {
  const normalized = normalizeText(value);
  const latinTokens = normalized.match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [];
  const cjkTokens = normalized.match(/[\u4e00-\u9fff]{2,6}/g) ?? [];

  return [...latinTokens, ...cjkTokens]
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 2 &&
        !/^\d+$/.test(token) &&
        !STOP_WORDS.has(token) &&
        ![...STOP_WORDS].some((stopWord) => token.includes(stopWord))
    );
}

function getArticleTokens(article: NewsArticle) {
  return new Set(
    tokenize(`${article.title} ${article.description ?? ""}`)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>) {
  const intersection = [...a].filter((token) => b.has(token)).length;
  if (intersection === 0) return 0;

  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function getLatestPublishedAt(articles: NewsArticle[]) {
  const timestamps = articles
    .map((article) => article.publishedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) return new Date().toISOString();
  return new Date(Math.max(...timestamps)).toISOString();
}

function getDominantCategory(articles: NewsArticle[]) {
  const counts = new Map<string, number>();

  articles.forEach((article) => {
    const category = article.category || "新聞";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  });

  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "新聞"
  );
}

function getTopKeywords(articles: NewsArticle[], limit: number) {
  const counts = new Map<string, number>();

  articles.forEach((article) => {
    getArticleTokens(article).forEach((token) => {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

function makeCandidateTitle(articles: NewsArticle[], keywords: string[]) {
  const representativeTitle = articles
    .map((article) => cleanTitle(article.title))
    .sort((a, b) => a.length - b.length)[0];

  if (representativeTitle) {
    return representativeTitle;
  }

  return keywords.slice(0, 2).join(" / ") || "候選主題";
}

function cleanTitle(value: string) {
  return value
    .replace(/\s+-\s+[^-]{2,40}$/g, "")
    .replace(/\s+\|\s+[^|]{2,40}$/g, "")
    .replace(/\b[a-z0-9-]+\.(com|tw|org|net|io|ai)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function computeHeatScore(articles: NewsArticle[]) {
  const sourceCount = new Set(articles.map((article) => article.sourceName)).size;
  const articleCount = articles.length;
  const now = Date.now();
  const recentCount = articles.filter((article) => {
    if (!article.publishedAt) return false;
    const time = new Date(article.publishedAt).getTime();
    return !Number.isNaN(time) && now - time <= 1000 * 60 * 60 * 6;
  }).length;

  return sourceCount * 30 + articleCount * 10 + recentCount * 20;
}

export function discoverCandidateTopics(
  articles: NewsArticle[],
  options?: {
    maxTopics?: number;
    minArticles?: number;
    similarityThreshold?: number;
  }
): CandidateTopic[] {
  const maxTopics = options?.maxTopics ?? 6;
  const minArticles = options?.minArticles ?? 2;
  const similarityThreshold = options?.similarityThreshold ?? 0.18;

  const articleTokens = new Map<string, Set<string>>();
  articles.forEach((article) => {
    articleTokens.set(article.id, getArticleTokens(article));
  });

  const unused = new Set(articles.map((article) => article.id));
  const clusters: NewsArticle[][] = [];

  for (const seed of articles) {
    if (!unused.has(seed.id)) continue;

    const seedTokens = articleTokens.get(seed.id) ?? new Set<string>();
    const cluster = [seed];
    unused.delete(seed.id);

    for (const candidate of articles) {
      if (!unused.has(candidate.id)) continue;

      const candidateTokens = articleTokens.get(candidate.id) ?? new Set<string>();
      const similarity = jaccardSimilarity(seedTokens, candidateTokens);
      if (similarity >= similarityThreshold) {
        cluster.push(candidate);
        unused.delete(candidate.id);
      }
    }

    if (cluster.length >= minArticles) {
      clusters.push(cluster);
    }
  }

  return clusters
    .map((cluster, index) => {
      const keywords = getTopKeywords(cluster, 6);
      const sourceCount = new Set(cluster.map((article) => article.sourceName)).size;

      return {
        id: `candidate-${index + 1}`,
        title: makeCandidateTitle(cluster, keywords),
        category: getDominantCategory(cluster),
        keywords,
        articleCount: cluster.length,
        sourceCount,
        heatScore: computeHeatScore(cluster),
        latestPublishedAt: getLatestPublishedAt(cluster),
        articles: cluster.slice(0, 8).map((article) => ({
          id: article.id,
          title: article.title,
          sourceName: article.sourceName,
          category: article.category ?? "",
          link: article.link ?? "",
          publishedAt: article.publishedAt,
        })),
      } satisfies CandidateTopic;
    })
    .sort((a, b) => b.heatScore - a.heatScore)
    .slice(0, maxTopics);
}
