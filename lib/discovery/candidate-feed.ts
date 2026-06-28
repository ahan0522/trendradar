import { getArticlesFromDatabase } from "@/lib/db";
import { getNewsItems } from "@/lib/rss";

export async function getDiscoveryArticles(limit = 800) {
  const [databaseArticles, rssArticles] = await Promise.all([
    getArticlesFromDatabase({ limit }).catch(() => []),
    getNewsItems({
      category: "全部",
      q: "",
      limit: Math.min(limit, 300),
      refresh: false,
    }).catch(() => []),
  ]);

  const merged = [...databaseArticles, ...rssArticles];
  const unique = new Map<string, (typeof merged)[number]>();
  for (const article of merged) {
    const key = article.link || article.id;
    const existing = unique.get(key);
    const existingTime = existing?.publishedAt
      ? new Date(existing.publishedAt).getTime()
      : 0;
    const currentTime = article.publishedAt
      ? new Date(article.publishedAt).getTime()
      : 0;
    if (!existing || currentTime >= existingTime) unique.set(key, article);
  }

  const cutoff = Date.now() - 30 * 86400000;
  return [...unique.values()]
    .filter((article) => {
      if (!article.publishedAt) return false;
      const publishedAt = new Date(article.publishedAt).getTime();
      return !Number.isNaN(publishedAt) && publishedAt >= cutoff;
    })
    .sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}

export function getRecentDiscoveryArticles<T extends { publishedAt: string | null }>(
  articles: T[],
  days = 7,
  limit = 900,
) {
  const cutoff = Date.now() - days * 86400000;
  return articles
    .filter((article) => {
      if (!article.publishedAt) return false;
      const publishedAt = new Date(article.publishedAt).getTime();
      return !Number.isNaN(publishedAt) && publishedAt >= cutoff;
    })
    .slice(0, limit);
}
