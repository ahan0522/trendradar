import { NextRequest, NextResponse } from "next/server";
import { cleanRssText } from "@/lib/rss";
import { generateArticleQuickSummary } from "@/lib/topic-ai";
import { createServiceRoleClient } from "../../../../../utils/supabase/server";

type DbTopicRow = {
  id: string;
  slug: string;
  title: string;
  long_title: string | null;
  category: string | null;
  hero_image_url: string | null;
  heat_score: number | null;
  source_count: number | null;
  article_count: number | null;
  last_article_published_at: string | null;
  last_synced_at: string | null;
  summary: string | null;
  bullets: string[] | null;
  subtopics: string[] | null;
  tags: string[] | null;
  rule_key: string | null;
  keywords: string[] | null;
  discovery_mode: string | null;
  status: string | null;
};

type DbTopicArticleRow = {
  article_id: string;
};

type DbArticleRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  region: string | null;
  source_id: string | null;
  source_name: string | null;
  link: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ResponseArticle = {
  id: string;
  title: string;
  description: string;
  quickSummary: string;
  category: string;
  region: string;
  sourceId: string;
  sourceName: string;
  link: string;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[a-z0-9-]+\.(com|tw|org|net|io|ai)\b/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getArticleSimilarityKey(article: ResponseArticle) {
  const summary = normalizeComparableText(article.quickSummary);

  if (summary.length >= 20) {
    return `summary:${summary.slice(0, 80)}`;
  }

  return `title:${normalizeComparableText(article.title).slice(0, 80)}`;
}

function mergeSourceNames(sourceNames: string[]) {
  return [...new Set(sourceNames.filter(Boolean))].join("、") || "未知來源";
}

function dedupeSimilarArticles(articles: ResponseArticle[]) {
  const articleGroups = new Map<string, ResponseArticle[]>();

  articles.forEach((article) => {
    const key = getArticleSimilarityKey(article);
    articleGroups.set(key, [...(articleGroups.get(key) ?? []), article]);
  });

  return [...articleGroups.values()]
    .map((group) => {
      const sortedGroup = [...group].sort((a, b) => {
        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

        return bTime - aTime;
      });
      const primary = sortedGroup[0];

      return {
        ...primary,
        sourceName: mergeSourceNames(sortedGroup.map((article) => article.sourceName)),
      };
    })
    .sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

      return bTime - aTime;
    })
    .slice(0, 8);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildReadableBullets(
  topicBullets: string[] | null,
  articles: ResponseArticle[]
) {
  const articleSummaries = uniqueStrings(
    articles
      .map((article) => article.quickSummary)
      .filter((summary) => summary.length >= 12)
  ).slice(0, 4);

  if (articleSummaries.length > 0) {
    return articleSummaries;
  }

  return Array.isArray(topicBullets) ? topicBullets : [];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = createServiceRoleClient();

    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .select(`
        id,
        slug,
        title,
        long_title,
        category,
        hero_image_url,
        heat_score,
        source_count,
        article_count,
        last_article_published_at,
        last_synced_at,
        summary,
        bullets,
        subtopics,
        tags,
        rule_key,
        keywords,
        discovery_mode,
        status
      `)
      .eq("slug", slug)
      .eq("status", "active")
      .single<DbTopicRow>();

    if (topicError || !topic) {
      return NextResponse.json(
        {
          ok: false,
          error: "找不到主題",
        },
        { status: 404 }
      );
    }

    const { data: topicArticleRows, error: topicArticlesError } = await supabase
      .from("topic_articles")
      .select("article_id")
      .eq("topic_id", topic.id)
      .returns<DbTopicArticleRow[]>();

    if (topicArticlesError) {
      return NextResponse.json(
        {
          ok: false,
          error: `讀取 topic_articles 失敗: ${topicArticlesError.message}`,
        },
        { status: 500 }
      );
    }

    const articleIds = (topicArticleRows ?? []).map((row) => row.article_id);

    let articles: DbArticleRow[] = [];

    if (articleIds.length > 0) {
      const { data: articleRows, error: articlesError } = await supabase
        .from("articles")
        .select(`
          id,
          title,
          description,
          category,
          region,
          source_id,
          source_name,
          link,
          published_at,
          created_at,
          updated_at
        `)
        .in("id", articleIds)
        .returns<DbArticleRow[]>();

      if (articlesError) {
        return NextResponse.json(
          {
            ok: false,
            error: `讀取 articles 失敗: ${articlesError.message}`,
          },
          { status: 500 }
        );
      }

      const articleMap = new Map<string, DbArticleRow>();
      (articleRows ?? []).forEach((article) => {
        articleMap.set(article.id, article);
      });

      articles = articleIds
        .map((id) => articleMap.get(id))
        .filter((value): value is DbArticleRow => Boolean(value));
    }

    const responseArticles = articles.map((article) => {
      const description = article.description ? cleanRssText(article.description) : "";
      const sourceName = article.source_name ?? "";

      return {
        id: article.id,
        title: article.title,
        description,
        quickSummary: generateArticleQuickSummary({
          title: article.title,
          description,
          sourceName,
        }),
        category: article.category ?? "",
        region: article.region ?? "",
        sourceId: article.source_id ?? "",
        sourceName,
        link: article.link ?? "#",
        publishedAt: article.published_at,
        createdAt: article.created_at,
        updatedAt: article.updated_at,
      };
    });

    const dedupedArticles = dedupeSimilarArticles(responseArticles);

    const responseBullets = buildReadableBullets(topic.bullets, dedupedArticles);

    const responseTopic = {
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      longTitle: topic.long_title ?? topic.title,
      category: topic.category ?? "",
      heroImageUrl: topic.hero_image_url ?? "",
      heatScore: topic.heat_score ?? 0,
      sourceCount: topic.source_count ?? 0,
      articleCount: dedupedArticles.length,
      updatedAt:
        topic.last_article_published_at ??
        topic.last_synced_at ??
        new Date().toISOString(),
      summary: topic.summary ?? "",
      bullets: responseBullets,
      subtopics: Array.isArray(topic.subtopics) ? topic.subtopics : [],
      tags: Array.isArray(topic.tags) ? topic.tags : [],
      ruleKey: topic.rule_key ?? "",
      keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
      discoveryMode: topic.discovery_mode ?? "rule_based",
      articles: dedupedArticles,
    };

    return NextResponse.json({
      ok: true,
      topic: responseTopic,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤";

    return NextResponse.json(
      {
        ok: false,
        error: `db topic detail 執行失敗: ${message}`,
      },
      { status: 500 }
    );
  }
}
