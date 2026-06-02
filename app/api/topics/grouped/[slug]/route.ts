import { NextRequest, NextResponse } from "next/server";
import { getNewsItems } from "@/lib/rss";
import { topicRules } from "@/data/topic-rules";
import { generateTopicAiSummary } from "@/lib/topic-ai";

type NewsArticle = {
  id: string;
  title: string;
  description?: string;
  sourceName: string;
  category?: string;
  link?: string;
  publishedAt: string | null;
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

function buildSummary(title: string, articles: NewsArticle[]) {
  const sourceCount = new Set(articles.map((article) => article.sourceName)).size;
  return `近期與「${title}」相關的熱門新聞共有 ${articles.length} 篇，來自 ${sourceCount} 家媒體，主要討論集中在最新發展、事件結果與延伸影響。`;
}

function buildBullets(title: string, articles: NewsArticle[]) {
  const firstTitles = articles.slice(0, 3).map((article) => article.title);

  if (firstTitles.length === 0) {
    return [`近期「${title}」相關新聞持續累積中`];
  }

  return firstTitles.map((item) => item);
}

function buildSubtopics(ruleKeywords: readonly string[]) {
  return ruleKeywords.slice(0, 4).map((item) => item);
}

function computeHeatScore(input: {
  sourceCount: number;
  articleCount: number;
  recentGrowthCount: number;
}) {
  return (
    input.sourceCount * 30 +
    input.articleCount * 10 +
    input.recentGrowthCount * 20
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const rule = topicRules.find((item) => item.key === slug);

  if (!rule) {
    return NextResponse.json(
      { ok: false, error: "未找到主題規則" },
      { status: 404 }
    );
  }

  const newsItems = await getNewsItems({
    category: "全部",
    q: "",
    limit: 100,
  });

  const articles: NewsArticle[] = newsItems.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description ?? "",
    sourceName: item.sourceName,
    category: item.category ?? "",
    sourcePool: item.sourcePool,
    sourceKind: item.sourceKind,
    sourceTier: item.sourceTier,
    sourceWeight: item.sourceWeight,
    credibilityWeight: item.credibilityWeight,
    sourceRole: item.sourceRole,
    link: item.link,
    publishedAt: item.publishedAt,
  }));

  const matchedArticles = articles.filter((article) =>
    articleMatchesRule(article, rule.keywords)
  );

  if (matchedArticles.length === 0) {
    return NextResponse.json(
      { ok: false, error: "此主題目前沒有對應文章" },
      { status: 404 }
    );
  }

  const sourceCount = new Set(
    matchedArticles.map((article) => article.sourceName)
  ).size;

  const articleCount = matchedArticles.length;

  const now = Date.now();
  const recentGrowthCount = matchedArticles.filter((article) => {
    if (!article.publishedAt) return false;
    const diff = now - new Date(article.publishedAt).getTime();
    return diff <= 1000 * 60 * 60 * 6;
  }).length;

  const aiResult = await generateTopicAiSummary({
  topicTitle: rule.title,
  category: rule.category,
  keywords: rule.keywords,
  articles: matchedArticles.map((article) => ({
    title: article.title,
    description: article.description ?? "",
    sourceName: article.sourceName,
  })),
});

const topic = {
  id: `topic-${rule.key}`,
  slug: rule.key,
  title: rule.title,
  longTitle: aiResult.longTitle,
  category: rule.category,
  heroImageUrl: getHeroImageByRule(rule.key),
  heatScore: computeHeatScore({
    sourceCount,
    articleCount,
    recentGrowthCount,
  }),
  sourceCount,
  articleCount,
  updatedAt: getLatestPublishedAt(matchedArticles),
  summary: aiResult.summary,
  bullets: aiResult.bullets,
  subtopics: aiResult.subtopics,
  tags: aiResult.tags,
  articles: matchedArticles.slice(0, 10).map((article) => ({
    id: article.id,
    title: article.title,
    sourceName: article.sourceName,
    link: article.link ?? "#",
    publishedAt: article.publishedAt,
  })),
};

  return NextResponse.json({
    ok: true,
    topic,
  });
}
