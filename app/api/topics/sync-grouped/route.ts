import { NextResponse } from "next/server";
import { getNewsItems } from "@/lib/rss";
import { topicRules } from "@/data/topic-rules";
import { groupArticlesToHomepageTopics } from "@/lib/topic-grouping";
import { generateTopicAiSummary } from "@/lib/topic-ai";
import { createServiceRoleClient } from "../../../../utils/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NewsArticle = {
  id: string;
  title: string;
  description?: string;
  sourceName: string;
  category?: string;
  link?: string;
  publishedAt: string | null;
};

type PersistedArticle = {
  id: string;
  link: string;
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

function isAuthorized(request: Request) {
  const token = process.env.CRON_SECRET;

  if (!token) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  return bearer === token;
}

async function handleSyncGrouped(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized sync-grouped request",
      },
      { status: 401 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 }
    );
  }

  try {
    const supabase = createServiceRoleClient();

    const newsItems = await getNewsItems({
      category: "全部",
      q: "",
      limit: 100,
    });

    const articles: NewsArticle[] = newsItems
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description ?? "",
        sourceName: item.sourceName,
        category: item.category ?? "",
        link: item.link ?? "",
        publishedAt: item.publishedAt,
      }))
      .filter((item) => item.link);

    // 1. 先寫入 articles，直接拿回 DB 真正的 id
    const articleRows = articles.map((article) => ({
      title: article.title,
      link: article.link ?? "",
      source_id: null,
      source_name: article.sourceName,
      category: article.category ?? "",
      region: "global",
      published_at: article.publishedAt,
      description: article.description ?? "",
    }));

    const { data: persistedArticles, error: articlesError } = await supabase
      .from("articles")
      .upsert(articleRows, { onConflict: "link" })
      .select("id, link");

    if (articlesError) {
      return NextResponse.json(
        {
          ok: false,
          error: `寫入 articles 失敗: ${articlesError.message}`,
        },
        { status: 500 }
      );
    }

    const articleIdByLink = new Map<string, string>();
    (persistedArticles as PersistedArticle[] | null)?.forEach((article) => {
      articleIdByLink.set(article.link, article.id);
    });

    // 2. 再做主題分群
    const groupedTopics = groupArticlesToHomepageTopics(articles);

    const syncedTopics: Array<{
      slug: string;
      title: string;
      articleCount: number;
      sourceCount: number;
      heatScore: number;
    }> = [];

    for (const grouped of groupedTopics) {
      const rule = topicRules.find((item) => item.key === grouped.slug);
      if (!rule) continue;

      const matchedArticles = articles.filter((article) =>
        articleMatchesRule(article, rule.keywords)
      );

      if (matchedArticles.length === 0) continue;

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

      const topicRow = {
        slug: grouped.slug,
        title: grouped.title,
        long_title: aiResult.longTitle,
        category: grouped.category,
        summary: aiResult.summary,
        bullets: aiResult.bullets,
        subtopics: aiResult.subtopics,
        tags: aiResult.tags,
        hero_image_url: grouped.heroImageUrl,
        heat_score: grouped.heatScore,
        source_count: grouped.sourceCount,
        article_count: grouped.articleCount,
        last_article_published_at: getLatestPublishedAt(matchedArticles),
        last_synced_at: new Date().toISOString(),
        rule_key: rule.key,
        keywords: rule.keywords,
        discovery_mode: "rule_based",
        status: "active",
        region: "global",
      };

      const { data: upsertedTopics, error: topicError } = await supabase
        .from("topics")
        .upsert(topicRow, { onConflict: "slug" })
        .select("id, slug");

      if (topicError) {
        return NextResponse.json(
          {
            ok: false,
            error: `寫入 topics 失敗: ${topicError.message}`,
          },
          { status: 500 }
        );
      }

      const topicId = upsertedTopics?.[0]?.id;
      if (!topicId) {
        return NextResponse.json(
          {
            ok: false,
            error: `找不到 topics.id，slug=${grouped.slug}`,
          },
          { status: 500 }
        );
      }

      const topicArticleRows = matchedArticles
        .map((article) => {
          const persistedArticleId = article.link
            ? articleIdByLink.get(article.link)
            : undefined;

          if (!persistedArticleId) return null;

          return {
            topic_id: topicId,
            article_id: persistedArticleId,
          };
        })
        .filter(Boolean);

      const { error: topicArticlesError } = await supabase
        .from("topic_articles")
        .upsert(topicArticleRows as { topic_id: string; article_id: string }[], {
          onConflict: "topic_id,article_id",
        });

      if (topicArticlesError) {
        return NextResponse.json(
          {
            ok: false,
            error: `寫入 topic_articles 失敗: ${topicArticlesError.message}`,
          },
          { status: 500 }
        );
      }

      syncedTopics.push({
        slug: grouped.slug,
        title: grouped.title,
        articleCount: grouped.articleCount,
        sourceCount: grouped.sourceCount,
        heatScore: grouped.heatScore,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "topics-sync-grouped",
      triggeredBy: request.headers.get("user-agent")?.toLowerCase().includes("vercel")
        ? "vercel-cron"
        : "manual",
      syncedAt: new Date().toISOString(),
      articleCount: articles.length,
      persistedArticleCount: persistedArticles?.length ?? 0,
      topicCount: syncedTopics.length,
      topics: syncedTopics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤";

    return NextResponse.json(
      {
        ok: false,
        error: `sync-grouped 執行失敗: ${message}`,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleSyncGrouped(request);
}

export async function POST(request: Request) {
  return handleSyncGrouped(request);
}
