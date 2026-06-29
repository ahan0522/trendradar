import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { dedupeArticlesByEvent } from "@/lib/article-dedupe";
import { marketLenses } from "@/lib/signals/monthly-discovery";
import { getEffectiveSourceCount } from "@/lib/source-scoring";

loadEnvConfig(process.cwd());

type ArticleRow = {
  id: string;
  title: string;
  source_name: string;
  category: string | null;
  link: string;
  published_at: string | null;
};

async function main() {
  const asOfDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const startDate = `${asOfDate.slice(0, 7)}-01`;
  const rows: ArticleRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getSupabaseAdmin()
      .from("articles")
      .select("id, title, source_name, category, link, published_at")
      .gte("published_at", `${startDate}T00:00:00+08:00`)
      .lte("published_at", `${asOfDate}T23:59:59+08:00`)
      .order("published_at", { ascending: false })
      .range(offset, offset + pageSize - 1)
      .returns<ArticleRow[]>();
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }

  const articles = rows.map((row) => ({
    id: row.id,
    title: row.title,
    sourceName: row.source_name,
    category: row.category ?? "新聞",
    link: row.link,
    publishedAt: row.published_at,
  }));
  const categoryCounts = articles.reduce<Record<string, number>>((result, article) => {
    result[article.category] = (result[article.category] ?? 0) + 1;
    return result;
  }, {});
  const lenses = marketLenses.map((lens) => {
    const matches = articles.filter(
      (article) =>
        lens.pattern.test(article.title) &&
        (!lens.requiredContext || lens.requiredContext.test(article.title)) &&
        !lens.exclude?.test(article.title),
    );
    return {
      key: lens.key,
      titleMatches: matches.length,
      dedupedEvents: dedupeArticlesByEvent(matches).length,
      sourceCount: getEffectiveSourceCount(matches),
      samples: matches.slice(0, 3).map((item) => item.title),
    };
  });

  console.log(JSON.stringify({
    asOfDate,
    articleCount: articles.length,
    sourceCount: getEffectiveSourceCount(articles),
    categoryCounts,
    lenses,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
