import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-server";
import { getNewsItems } from "@/lib/rss";
import { getTopicsFromNews } from "@/lib/topic-clustering";
import type { NewsItem } from "@/types/news";
import type { TrendTopic } from "@/types/trend";

function nowIso() {
  return new Date().toISOString();
}

function toArticleRow(item: NewsItem) {
  return {
    id: item.id,
    title: item.title,
    link: item.link,
    source_id: item.sourceId,
    source_name: item.sourceName,
    category: item.category,
    region: item.region,
    published_at: item.publishedAt,
    description: item.description,
    updated_at: nowIso(),
  };
}

function toTopicRow(topic: TrendTopic) {
  return {
    id: topic.id,
    title: topic.title,
    category: topic.category,
    region: topic.region,
    trend_score: topic.score,
    velocity: topic.velocity,
    sentiment: topic.sentiment,
    summary: topic.summary,
    bullets: topic.bullets,
    sources: topic.sources,
    metrics: topic.metrics,
    last_seen_at: topic.updatedAt,
    updated_at: nowIso(),
  };
}

function fromTopicRow(row: Record<string, any>): TrendTopic {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    region: row.region,
    score: Number(row.trend_score ?? 0),
    velocity: Number(row.velocity ?? 0),
    sentiment: row.sentiment ?? "待分析",
    updatedAt: row.last_seen_at ?? row.updated_at ?? new Date().toISOString(),
    sources: Array.isArray(row.sources) ? row.sources : [],
    summary: row.summary ?? "",
    bullets: Array.isArray(row.bullets) ? row.bullets : [],
    metrics: {
      searchScore: Number(row.metrics?.searchScore ?? 0),
      newsScore: Number(row.metrics?.newsScore ?? 0),
      socialScore: Number(row.metrics?.socialScore ?? 0),
      engagementScore: Number(row.metrics?.engagementScore ?? 0),
      velocityScore: Number(row.metrics?.velocityScore ?? 0),
      diversityScore: Number(row.metrics?.diversityScore ?? 0),
    },
  };
}

function fromArticleRow(row: Record<string, any>): NewsItem {
  return {
    id: row.id,
    title: row.title,
    link: row.link,
    sourceId: row.source_id,
    sourceName: row.source_name,
    category: row.category,
    region: row.region,
    publishedAt: row.published_at,
    description: row.description ?? "",
  };
}




function tokenizeTopicTitle(title: string) {
  return Array.from(
    new Set(
      title
        .split(/[\s｜|:：,，、()（）\-–_]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
        .slice(0, 8),
    ),
  );
}

export async function getTopicDetailFromDatabase(topicId: string) {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseAdmin();
  const { data: topicRow, error: topicError } = await supabase.from("topics").select("*").eq("id", topicId).maybeSingle();
  if (topicError) throw new Error(`Read topic failed: ${topicError.message}`);
  if (!topicRow) return null;

  const topic = fromTopicRow(topicRow);
  const tokens = tokenizeTopicTitle(topic.title);

  let relatedQuery = supabase
    .from("articles")
    .select("*")
    .eq("category", topic.category)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(12);

  if (tokens.length) {
    const pattern = tokens
      .map((token) => `title.ilike.%${token}%,description.ilike.%${token}%`)
      .join(",");
    relatedQuery = relatedQuery.or(pattern);
  }

  const [articlesRes, metricsRes, status] = await Promise.all([
    relatedQuery,
    supabase
      .from("trend_metrics")
      .select("measured_at,total_score,velocity_score,news_score")
      .eq("topic_id", topicId)
      .order("measured_at", { ascending: false })
      .limit(12),
    getDatabaseStatus(),
  ]);

  if (articlesRes.error) throw new Error(`Read related articles failed: ${articlesRes.error.message}`);
  if (metricsRes.error) throw new Error(`Read topic metrics failed: ${metricsRes.error.message}`);

  const relatedArticles = (articlesRes.data ?? []).map(fromArticleRow);
  const sourceMap = new Map();
  for (const article of relatedArticles) {
    sourceMap.set(article.sourceName, (sourceMap.get(article.sourceName) ?? 0) + 1);
  }
  const sourceStats = Array.from(sourceMap.entries())
    .map(([sourceName, count]) => ({ sourceName, count }))
    .sort((a, b) => b.count - a.count);

  const metricsTimeline = (metricsRes.data ?? [])
    .map((row) => ({
      measuredAt: row.measured_at,
      totalScore: Number(row.total_score ?? 0),
      velocityScore: Number(row.velocity_score ?? 0),
      newsScore: Number(row.news_score ?? 0),
    }))
    .reverse();

  return {
    topic,
    relatedArticles,
    sourceStats,
    metricsTimeline,
    lastSyncedAt: status.lastSyncedAt,
  };
}


export async function getDatabaseStatus() {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      lastSyncedAt: null as string | null,
      topicCount: 0,
      articleCount: 0,
    };
  }

  const supabase = getSupabaseAdmin();

  const [{ count: topicCount, error: topicsError }, { count: articleCount, error: articlesError }, { data: metricRow, error: metricsError }] = await Promise.all([
    supabase.from("topics").select("id", { count: "exact", head: true }),
    supabase.from("articles").select("id", { count: "exact", head: true }),
    supabase.from("trend_metrics").select("measured_at").order("measured_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (topicsError) throw new Error(`Count topics failed: ${topicsError.message}`);
  if (articlesError) throw new Error(`Count articles failed: ${articlesError.message}`);
  if (metricsError) throw new Error(`Read latest sync failed: ${metricsError.message}`);

  return {
    configured: true,
    lastSyncedAt: metricRow?.measured_at ?? null,
    topicCount: topicCount ?? 0,
    articleCount: articleCount ?? 0,
  };
}

export async function syncRssToDatabase(options?: { refresh?: boolean; limit?: number }) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add .env.local and run supabase/schema.sql first.");
  }

  const supabase = getSupabaseAdmin();
  const articles = await getNewsItems({ limit: options?.limit ?? 150, refresh: options?.refresh ?? true });
  const topics = await getTopicsFromNews({ limit: 60, refresh: false });

  if (articles.length) {
    const { error } = await supabase.from("articles").upsert(articles.map(toArticleRow), {
      onConflict: "link",
    });
    if (error) throw new Error(`Sync articles failed: ${error.message}`);
  }

  if (topics.length) {
    const { error } = await supabase.from("topics").upsert(topics.map(toTopicRow), {
      onConflict: "id",
    });
    if (error) throw new Error(`Sync topics failed: ${error.message}`);

    const metricRows = topics.map((topic) => ({
      topic_id: topic.id,
      search_score: topic.metrics.searchScore,
      news_score: topic.metrics.newsScore,
      social_score: topic.metrics.socialScore,
      engagement_score: topic.metrics.engagementScore,
      velocity_score: topic.metrics.velocityScore,
      diversity_score: topic.metrics.diversityScore,
      total_score: topic.score,
    }));

    const { error: metricError } = await supabase.from("trend_metrics").insert(metricRows);
    if (metricError) throw new Error(`Insert metrics failed: ${metricError.message}`);
  }

  return {
    syncedAt: nowIso(),
    articleCount: articles.length,
    topicCount: topics.length,
  };
}

export async function getTopicsFromDatabase(options?: {
  category?: string;
  q?: string;
  region?: string;
  limit?: number;
}) {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("topics")
    .select("*")
    .order("trend_score", { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(options?.limit ?? 30);

  if (options?.category && options.category !== "全部") query = query.eq("category", options.category);
  if (options?.region && options.region !== "全部") query = query.or(`region.ilike.%${options.region}%,region.ilike.%全球%`);
  if (options?.q) query = query.or(`title.ilike.%${options.q}%,summary.ilike.%${options.q}%,category.ilike.%${options.q}%`);

  const { data, error } = await query;
  if (error) throw new Error(`Query topics failed: ${error.message}`);

  return (data ?? []).map(fromTopicRow);
}

export async function getArticlesFromDatabase(options?: {
  category?: string;
  q?: string;
  region?: string;
  limit?: number;
}) {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("articles")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(options?.limit ?? 50);

  if (options?.category && options.category !== "全部") query = query.eq("category", options.category);
  if (options?.region && options.region !== "全部") query = query.or(`region.ilike.%${options.region}%,region.ilike.%全球%`);
  if (options?.q) query = query.or(`title.ilike.%${options.q}%,description.ilike.%${options.q}%,source_name.ilike.%${options.q}%`);

  const { data, error } = await query;
  if (error) throw new Error(`Query articles failed: ${error.message}`);

  return (data ?? []).map(fromArticleRow);
}
