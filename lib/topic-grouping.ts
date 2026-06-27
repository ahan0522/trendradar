import { topicRules } from "@/data/topic-rules";
import {
  computeWeightedHeatScore,
  getEffectiveSourceCount,
} from "@/lib/source-scoring";
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function textMatchesTopicKeyword(text: string, keyword: string) {
  const normalizedKeyword = normalizeText(keyword);
  if (/^[a-z0-9+.-]+$/.test(normalizedKeyword)) {
    return new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}([^a-z0-9]|$)`,
      "i",
    ).test(text);
  }
  return text.includes(normalizedKeyword);
}

export function articleMatchesRule(
  article: NewsArticle,
  keywords: readonly string[],
  excludeKeywords?: readonly string[]
) {
  const titleText = normalizeText(article.title);
  const haystack = normalizeText(`${article.title} ${article.description ?? ""}`);

  if (
    excludeKeywords?.some((keyword) =>
      textMatchesTopicKeyword(haystack, keyword)
    )
  ) {
    return false;
  }

  if (keywords.some((keyword) => textMatchesTopicKeyword(titleText, keyword))) {
    return true;
  }

  const fullTextMatches = keywords.filter((keyword) =>
    textMatchesTopicKeyword(haystack, keyword)
  );
  return new Set(fullTextMatches.map(normalizeText)).size >= 2;
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
    ai:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
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
      if (articleMatchesRule(article, rule.keywords, rule.excludeKeywords)) {
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
      const sourceCount = getEffectiveSourceCount(bucket.articles);

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
