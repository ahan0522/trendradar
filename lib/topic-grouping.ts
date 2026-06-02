import { topicRules } from "@/data/topic-rules";
import { computeWeightedHeatScore } from "@/lib/source-scoring";
import type { HomepageTopicCard } from "@/types/topic";
import type { SourceKind, SourcePool, SourceRole, SourceTier } from "@/types/news";

type NewsArticle = {
  id: string;
  title: string;
  description?: string;
  sourceName: string;
  category?: string;
  sourcePool?: SourcePool;
  sourceKind?: SourceKind;
  sourceTier?: SourceTier;
  sourceWeight?: number;
  credibilityWeight?: number;
  sourceRole?: SourceRole;
  publishedAt: string | null;
};

type TopicGroupBucket = {
  ruleKey: string;
  title: string;
  category: string;
  articles: NewsArticle[];
};

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function articleMatchesRule(article: NewsArticle, keywords: readonly string[]) {
  const haystack = normalizeText(
    `${article.title} ${article.description ?? ""} ${article.category ?? ""}`
  );

  return keywords.some((keyword) => haystack.includes(normalizeText(keyword)));
}

function getLatestPublishedAt(articles: NewsArticle[]) {
  const timestamps = articles
    .map((article) => article.publishedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) {
    return new Date().toISOString();
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function getHeroImageByRule(ruleKey: string) {
  const imageMap: Record<string, string> = {
    "nvidia-jensen":
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    nba: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80",
    iphone:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
    "taiwan-security":
      "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80",
  };

  return (
    imageMap[ruleKey] ??
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80"
  );
}

export function groupArticlesToHomepageTopics(
  articles: NewsArticle[]
): HomepageTopicCard[] {
  const buckets: TopicGroupBucket[] = topicRules.map((rule) => ({
    ruleKey: rule.key,
    title: rule.title,
    category: rule.category,
    articles: [],
  }));

  for (const article of articles) {
    for (const rule of topicRules) {
      if (articleMatchesRule(article, rule.keywords)) {
        const bucket = buckets.find((item) => item.ruleKey === rule.key);
        if (bucket) {
          bucket.articles.push(article);
        }
      }
    }
  }

  const topicCards: HomepageTopicCard[] = buckets
    .filter((bucket) => bucket.articles.length > 0)
    .map((bucket) => {
      const sourceCount = new Set(
        bucket.articles.map((article) => article.sourceName)
      ).size;

      const articleCount = bucket.articles.length;
      const heatScore = computeWeightedHeatScore(bucket.articles);

      return {
        id: `topic-${bucket.ruleKey}`,
        slug: bucket.ruleKey,
        title: bucket.title,
        category: bucket.category,
        heroImageUrl: getHeroImageByRule(bucket.ruleKey),
        heatScore,
        sourceCount,
        articleCount,
        updatedAt: getLatestPublishedAt(bucket.articles),
      };
    })
    .sort((a, b) => b.heatScore - a.heatScore);

  return topicCards;
}
