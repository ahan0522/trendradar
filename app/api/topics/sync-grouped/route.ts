import { NextResponse } from "next/server";
import { getNewsItems } from "@/lib/rss";
import { topicRules } from "@/data/topic-rules";
import { groupArticlesToHomepageTopics } from "@/lib/topic-grouping";
import { getHeroImageForCategory } from "@/lib/topic-home";
import { discoverCandidateTopics } from "@/lib/topic-candidates";
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

type SyncedTopic = {
  slug: string;
  title: string;
  discoveryMode: string;
  articleCount: number;
  sourceCount: number;
  heatScore: number;
  linkedArticleCount: number;
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

function getTriggerSource(request: Request) {
  return request.headers.get("user-agent")?.toLowerCase().includes("vercel")
    ? "vercel-cron"
    : "manual";
}

async function handleSyncGrouped(request: Request) {
  const startedAt = Date.now();
  const runId =
    crypto.randomUUID?.() ?? `sync-${startedAt}-${Math.random().toString(36).slice(2)}`;

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

    console.info("[sync-grouped] started", {
      runId,
      triggeredBy: getTriggerSource(request),
    });

    const newsItems = await getNewsItems({
      category: "全部",
      q: "",
      limit: 160,
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
    const candidateTopics = discoverCandidateTopics(articles, {
      maxTopics: 6,
      minArticles: 2,
    }).filter((topic) => topic.publishable);

    const syncedTopics: SyncedTopic[] = [];
    let linkedArticleCount = 0;
    let skippedTopicsWithoutRule = 0;
    let skippedTopicsWithoutArticles = 0;

    for (const grouped of groupedTopics) {
      const rule = topicRules.find((item) => item.key === grouped.slug);
      if (!rule) {
        skippedTopicsWithoutRule += 1;
        continue;
      }

      const matchedArticles = articles.filter((article) =>
        articleMatchesRule(article, rule.keywords)
      );

      if (matchedArticles.length === 0) {
        skippedTopicsWithoutArticles += 1;
        continue;
      }

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

      linkedArticleCount += topicArticleRows.length;

      const { error: deleteTopicArticlesError } = await supabase
        .from("topic_articles")
        .delete()
        .eq("topic_id", topicId);

      if (deleteTopicArticlesError) {
        return NextResponse.json(
          {
            ok: false,
            error: `清理舊 topic_articles 失敗: ${deleteTopicArticlesError.message}`,
          },
          { status: 500 }
        );
      }

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
        discoveryMode: "rule_based",
        articleCount: grouped.articleCount,
        sourceCount: grouped.sourceCount,
        heatScore: grouped.heatScore,
        linkedArticleCount: topicArticleRows.length,
      });
    }

    const { error: archiveCandidateTopicsError } = await supabase
      .from("topics")
      .update({
        status: "inactive",
        last_synced_at: new Date().toISOString(),
      })
      .eq("discovery_mode", "candidate_cluster");

    if (archiveCandidateTopicsError) {
      return NextResponse.json(
        {
          ok: false,
          error: `封存舊候選 topics 失敗: ${archiveCandidateTopicsError.message}`,
        },
        { status: 500 }
      );
    }

    const syncedRuleTitles = new Set(
      syncedTopics.map((topic) => normalizeText(topic.title))
    );

    for (const candidate of candidateTopics) {
      if (syncedRuleTitles.has(normalizeText(candidate.title))) {
        continue;
      }

      const matchedArticles = candidate.articles
        .map((candidateArticle) =>
          articles.find((article) => article.link === candidateArticle.link)
        )
        .filter((article): article is NewsArticle => Boolean(article));

      if (matchedArticles.length === 0) {
        skippedTopicsWithoutArticles += 1;
        continue;
      }

      const aiResult = await generateTopicAiSummary({
        topicTitle: candidate.title,
        category: candidate.category,
        keywords: candidate.keywords,
        articles: matchedArticles.map((article) => ({
          title: article.title,
          description: article.description ?? "",
          sourceName: article.sourceName,
        })),
      });

      const topicRow = {
        slug: candidate.slug,
        title: candidate.title,
        long_title: aiResult.longTitle,
        category: candidate.category,
        summary: aiResult.summary || candidate.summary,
        bullets: aiResult.bullets,
        subtopics: aiResult.subtopics,
        tags: aiResult.tags,
        hero_image_url: getHeroImageForCategory(candidate.category),
        heat_score: candidate.heatScore,
        source_count: candidate.sourceCount,
        article_count: candidate.articleCount,
        last_article_published_at: candidate.latestPublishedAt,
        last_synced_at: new Date().toISOString(),
        rule_key: null,
        keywords: candidate.keywords,
        discovery_mode: "candidate_cluster",
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
            error: `寫入候選 topics 失敗: ${topicError.message}`,
          },
          { status: 500 }
        );
      }

      const topicId = upsertedTopics?.[0]?.id;
      if (!topicId) {
        return NextResponse.json(
          {
            ok: false,
            error: `找不到候選 topics.id，slug=${candidate.slug}`,
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

      linkedArticleCount += topicArticleRows.length;

      const { error: deleteTopicArticlesError } = await supabase
        .from("topic_articles")
        .delete()
        .eq("topic_id", topicId);

      if (deleteTopicArticlesError) {
        return NextResponse.json(
          {
            ok: false,
            error: `清理候選 topic_articles 失敗: ${deleteTopicArticlesError.message}`,
          },
          { status: 500 }
        );
      }

      const { error: topicArticlesError } = await supabase
        .from("topic_articles")
        .upsert(topicArticleRows as { topic_id: string; article_id: string }[], {
          onConflict: "topic_id,article_id",
        });

      if (topicArticlesError) {
        return NextResponse.json(
          {
            ok: false,
            error: `寫入候選 topic_articles 失敗: ${topicArticlesError.message}`,
          },
          { status: 500 }
        );
      }

      syncedTopics.push({
        slug: candidate.slug,
        title: candidate.title,
        discoveryMode: "candidate_cluster",
        articleCount: candidate.articleCount,
        sourceCount: candidate.sourceCount,
        heatScore: candidate.heatScore,
        linkedArticleCount: topicArticleRows.length,
      });
    }

    const summary = {
      ok: true,
      runId,
      mode: "topics-sync-grouped",
      triggeredBy: getTriggerSource(request),
      syncedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      articleCount: articles.length,
      persistedArticleCount: persistedArticles?.length ?? 0,
      groupedTopicCount: groupedTopics.length,
      candidateTopicCount: candidateTopics.length,
      topicCount: syncedTopics.length,
      linkedArticleCount,
      skippedTopicsWithoutRule,
      skippedTopicsWithoutArticles,
      topics: syncedTopics,
    };

    console.info("[sync-grouped] completed", summary);

    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤";

    console.error("[sync-grouped] failed", {
      runId,
      durationMs: Date.now() - startedAt,
      error: message,
    });

    return NextResponse.json(
      {
        ok: false,
        runId,
        error: `sync-grouped 執行失敗: ${message}`,
        durationMs: Date.now() - startedAt,
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
