import { NextResponse } from "next/server";
import { getTopicsFromNews } from "@/lib/topic-clustering";
import { mockTopics } from "@/data/mock-topics";
import { getDatabaseStatus, getTopicsFromDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "全部";
  const q = searchParams.get("q") ?? "";
  const refresh = searchParams.get("refresh") === "1";
  const limit = Number(searchParams.get("limit") ?? 30);
  const fallback = searchParams.get("fallback") !== "0";
  const region = searchParams.get("region") ?? "全部";
  const source = searchParams.get("source") ?? "rss";

  try {
    if (source === "db" || source === "database") {
      const [dbTopics, status] = await Promise.all([
        getTopicsFromDatabase({ category, q, region, limit }),
        getDatabaseStatus(),
      ]);

      if (!dbTopics.length && fallback) {
        return NextResponse.json({
          generatedAt: new Date().toISOString(),
          mode: "mock-fallback",
          count: filterTopicsByRegion(mockTopics, region).length,
          topics: filterTopicsByRegion(mockTopics, region).slice(0, limit),
        });
      }

      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        mode: "supabase-db",
        count: dbTopics.length,
        lastSyncedAt: status.lastSyncedAt,
        stats: {
          topicCount: status.topicCount,
          articleCount: status.articleCount,
        },
        topics: dbTopics,
      });
    }
    const topics = filterTopicsByRegion(await getTopicsFromNews({ category, q, limit, refresh }), region);

    if (!topics.length && fallback) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        mode: "mock-fallback",
        count: filterTopicsByRegion(mockTopics, region).length,
        topics: filterTopicsByRegion(mockTopics, region).slice(0, limit),
      });
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      mode: "rss-cluster",
      count: topics.length,
      topics,
    });
  } catch (error) {
    if (fallback) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        mode: "mock-fallback",
        error: error instanceof Error ? error.message : "Unknown RSS topic error",
        count: filterTopicsByRegion(mockTopics, region).length,
        topics: filterTopicsByRegion(mockTopics, region).slice(0, limit),
      });
    }

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        mode: "error",
        error: error instanceof Error ? error.message : "Unknown RSS topic error",
        topics: [],
      },
      { status: 500 },
    );
  }
}

function filterTopicsByRegion<T extends { region: string }>(topics: T[], region: string) {
  if (!region || region === "全部") return topics;
  return topics.filter((topic) => topic.region.includes(region) || topic.region.includes("全球"));
}
