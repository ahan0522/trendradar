import { getNewsItems } from "@/lib/rss";
import type { NewsItem } from "@/types/news";
import type { TrendCategory, TrendTopic } from "@/types/trend";

const STOP_WORDS = new Set([
  "的",
  "了",
  "是",
  "在",
  "和",
  "與",
  "及",
  "就",
  "都",
  "也",
  "而",
  "被",
  "將",
  "為",
  "有",
  "中",
  "對",
  "再",
  "新",
  "最新",
  "一次",
  "一個",
  "this",
  "that",
  "with",
  "from",
  "about",
  "after",
  "before",
  "into",
  "over",
  "under",
  "news",
  "report",
  "says",
  "will",
  "the",
  "and",
  "for",
  "are",
  "you",
  "your",
  "not",
  "but",
  "has",
  "have",
  "more",
]);

type TopicCluster = {
  key: string;
  titleTokens: string[];
  items: NewsItem[];
  sources: Set<string>;
  categories: Map<TrendCategory, number>;
  latestAt: number;
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[｜|:：,，.。!！?？()（）\[\]【】「」『』《》<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  const normalized = normalizeText(value);
  const latinTokens = normalized.match(/[a-z0-9][a-z0-9+.-]{1,}/g) ?? [];
  const cjkTokens = normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? [];

  return [...latinTokens, ...cjkTokens]
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function getClusterKey(item: NewsItem): { key: string; tokens: string[] } {
  const tokens = tokenize(`${item.title} ${item.description}`).slice(0, 8);
  const importantTokens = tokens
    .filter((token) => token.length >= 3 || /[\u4e00-\u9fff]{2,}/.test(token))
    .slice(0, 3);

  const keyTokens = importantTokens.length ? importantTokens : tokens.slice(0, 2);
  const key = keyTokens.join("-") || item.id;
  return { key, tokens: keyTokens };
}

function getDominantCategory(categories: Map<TrendCategory, number>): TrendCategory {
  return Array.from(categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "新聞";
}

function getLatestAt(items: NewsItem[]): number {
  return Math.max(
    ...items.map((item) => (item.publishedAt ? new Date(item.publishedAt).getTime() : 0)),
    0,
  );
}

function getVelocityScore(latestAt: number): number {
  if (!latestAt) return 35;
  const ageHours = Math.max((Date.now() - latestAt) / (1000 * 60 * 60), 0.1);
  if (ageHours <= 1) return 95;
  if (ageHours <= 3) return 88;
  if (ageHours <= 6) return 78;
  if (ageHours <= 12) return 68;
  if (ageHours <= 24) return 58;
  return 42;
}

function getRegion(items: NewsItem[]): string {
  const regions = Array.from(new Set(items.map((item) => item.region))).filter(Boolean);
  return regions.slice(0, 3).join(" / ") || "全球";
}

function getSummary(cluster: TopicCluster): string {
  const titles = cluster.items.slice(0, 3).map((item) => item.title);
  const sourceCount = cluster.sources.size;
  const category = getDominantCategory(cluster.categories);

  return `此話題目前由 ${sourceCount} 個來源共同出現，主要分類為「${category}」。系統根據新聞標題、來源重複度與發布時間判斷它正在形成趨勢。代表新聞包括：${titles.join("；")}。`;
}

function getBullets(cluster: TopicCluster): string[] {
  const topSources = Array.from(cluster.sources).slice(0, 3).join("、");
  const latest = cluster.latestAt ? new Date(cluster.latestAt).toLocaleString("zh-TW") : "未知";

  return [
    `關聯新聞數：${cluster.items.length} 篇`,
    `主要來源：${topSources || "RSS 來源"}`,
    `最新更新：${latest}`,
  ];
}

function makeTopicId(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return `rss-topic-${Math.abs(hash)}`;
}

function scoreCluster(cluster: TopicCluster) {
  const newsScore = Math.min(100, 35 + cluster.items.length * 18);
  const diversityScore = Math.min(100, 30 + cluster.sources.size * 22);
  const velocityScore = getVelocityScore(cluster.latestAt);
  const engagementScore = Math.min(100, 25 + cluster.items.length * 8 + cluster.sources.size * 10);
  const socialScore = Math.min(100, 20 + cluster.sources.size * 12);
  const searchScore = Math.min(100, 25 + cluster.titleTokens.length * 15);

  const total = Math.round(
    searchScore * 0.18 +
      newsScore * 0.32 +
      socialScore * 0.1 +
      engagementScore * 0.12 +
      velocityScore * 0.2 +
      diversityScore * 0.08,
  );

  return {
    total,
    metrics: {
      searchScore,
      newsScore,
      socialScore,
      engagementScore,
      velocityScore,
      diversityScore,
    },
  };
}

function clusterNewsItems(items: NewsItem[]): TopicCluster[] {
  const clusters = new Map<string, TopicCluster>();

  items.forEach((item) => {
    const { key, tokens } = getClusterKey(item);
    const existing = clusters.get(key);

    if (existing) {
      existing.items.push(item);
      existing.sources.add(item.sourceName);
      existing.categories.set(item.category, (existing.categories.get(item.category) ?? 0) + 1);
      existing.latestAt = Math.max(existing.latestAt, item.publishedAt ? new Date(item.publishedAt).getTime() : 0);
      return;
    }

    const categories = new Map<TrendCategory, number>();
    categories.set(item.category, 1);

    clusters.set(key, {
      key,
      titleTokens: tokens,
      items: [item],
      sources: new Set([item.sourceName]),
      categories,
      latestAt: item.publishedAt ? new Date(item.publishedAt).getTime() : 0,
    });
  });

  return Array.from(clusters.values());
}

export async function getTopicsFromNews(options?: {
  category?: string;
  q?: string;
  limit?: number;
  refresh?: boolean;
}): Promise<TrendTopic[]> {
  const newsItems = await getNewsItems({
    category: options?.category,
    q: options?.q,
    limit: 120,
    refresh: options?.refresh,
  });

  const clusters = clusterNewsItems(newsItems);

  const topics = clusters.map((cluster) => {
    cluster.items.sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    });

    const { total, metrics } = scoreCluster(cluster);
    const leadItem = cluster.items[0];
    const category = getDominantCategory(cluster.categories);

    return {
      id: makeTopicId(cluster.key),
      title: leadItem.title,
      category,
      region: getRegion(cluster.items),
      score: total,
      velocity: Math.round(metrics.velocityScore + cluster.items.length * 6),
      sentiment: "待分析",
      updatedAt: leadItem.publishedAt ?? new Date().toISOString(),
      sources: Array.from(cluster.sources),
      summary: getSummary(cluster),
      bullets: getBullets(cluster),
      metrics,
    } satisfies TrendTopic;
  });

  topics.sort((a, b) => b.score - a.score || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return topics.slice(0, options?.limit ?? 30);
}
