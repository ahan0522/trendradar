import { NextRequest, NextResponse } from "next/server";
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
  status: string | null;
};

type DbTopicArticleRow = {
  article_id: string;
};

type DbArticleRow = {
  id: string;
  title: string;
  source_name: string | null;
  link: string | null;
  published_at: string | null;
};

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
          source_name,
          link,
          published_at
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

    const responseTopic = {
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      longTitle: topic.long_title ?? topic.title,
      category: topic.category ?? "",
      heroImageUrl: topic.hero_image_url ?? "",
      heatScore: topic.heat_score ?? 0,
      sourceCount: topic.source_count ?? 0,
      articleCount: topic.article_count ?? 0,
      updatedAt:
        topic.last_article_published_at ??
        topic.last_synced_at ??
        new Date().toISOString(),
      summary: topic.summary ?? "",
      bullets: Array.isArray(topic.bullets) ? topic.bullets : [],
      subtopics: Array.isArray(topic.subtopics) ? topic.subtopics : [],
      tags: Array.isArray(topic.tags) ? topic.tags : [],
      articles: articles.map((article) => ({
        id: article.id,
        title: article.title,
        sourceName: article.source_name ?? "",
        link: article.link ?? "#",
        publishedAt: article.published_at,
      })),
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