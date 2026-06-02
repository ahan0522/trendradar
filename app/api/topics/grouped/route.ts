import { NextResponse } from "next/server";
import { groupArticlesToHomepageTopics } from "@/lib/topic-grouping";
import { getNewsItems } from "@/lib/rss";

export async function GET() {
  const newsItems = await getNewsItems({
    category: "全部",
    q: "",
    limit: 100,
  });

  const articles = newsItems.map((item) => ({
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
    publishedAt: item.publishedAt,
  }));

  const topics = groupArticlesToHomepageTopics(articles).slice(0, 4);

return NextResponse.json({
  generatedAt: new Date().toISOString(),
  count: topics.length,
  topics,
});
}
