import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceRoleClient } from "../../../../utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HomeTopic = {
  id: string;
  slug: string;
  title: string;
  category: string;
  heroImageUrl: string;
  heatScore: number;
  sourceCount: number;
  articleCount: number;
  updatedAt: string;
  discoveryMode: string;
};

function getTopicFamily(topic: HomeTopic) {
  const text = `${topic.title} ${topic.slug} ${topic.category}`.toLowerCase();

  if (/伊朗|美軍|美伊|中東|以色列|黎巴嫩|真主黨|停火|iran|israel/.test(text)) {
    return "middle-east";
  }

  if (/台海|東海|中國海警|兩岸|國防|軍演|taiwan-security/.test(text)) {
    return "taiwan-security";
  }

  if (/機器人|具身|robot|robotics|自動化/.test(text)) {
    return "ai-robotics";
  }

  if (/輝達|黃仁勳|nvidia|晶片|半導體|伺服器|資料中心|gpu/.test(text)) {
    return "ai-infrastructure";
  }

  if (/ai|人工智慧|模型|審查|監管|行政命令|policy|regulation/.test(text)) {
    return "ai-policy";
  }

  if (/nba|籃球|季後賽|總冠軍/.test(text)) {
    return "basketball";
  }

  if (/法網|網球|女雙|大滿貫|tennis/.test(text)) {
    return "tennis";
  }

  return topic.category || "general";
}

function isBroadFallbackTopic(topic: HomeTopic) {
  const title = topic.title.trim().toLowerCase();

  return (
    topic.discoveryMode !== "candidate_cluster" &&
    /^(ai|nba|iphone|3c|財經|國際|新聞|體育)$/.test(title)
  );
}

function getDiversityScore(topic: HomeTopic) {
  const discoveryBoost = topic.discoveryMode === "candidate_cluster" ? 600 : 0;
  const sourceBoost = Math.min(topic.sourceCount, 5) * 80;
  const articleBoost = Math.min(topic.articleCount, 8) * 30;
  const fallbackPenalty = isBroadFallbackTopic(topic) ? 900 : 0;

  return discoveryBoost + sourceBoost + articleBoost + topic.heatScore - fallbackPenalty;
}

function selectDiverseHomeTopics(topics: HomeTopic[], targetCount: number) {
  const selected: HomeTopic[] = [];
  const categoryCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();

  function addTopic(topic: HomeTopic, categoryLimit: number, familyLimit: number) {
    if (selected.some((item) => item.id === topic.id)) {
      return false;
    }

    const categoryCount = categoryCounts.get(topic.category) ?? 0;
    const family = getTopicFamily(topic);
    const familyCount = familyCounts.get(family) ?? 0;

    if (categoryCount >= categoryLimit || familyCount >= familyLimit) {
      return false;
    }

    selected.push(topic);
    categoryCounts.set(topic.category, categoryCount + 1);
    familyCounts.set(family, familyCount + 1);
    return true;
  }

  const strongTopics = topics
    .filter((topic) => !isBroadFallbackTopic(topic))
    .sort((a, b) => getDiversityScore(b) - getDiversityScore(a));

  for (const topic of strongTopics) {
    addTopic(topic, 1, 1);

    if (selected.length >= targetCount) {
      return selected;
    }
  }

  for (const topic of strongTopics) {
    addTopic(topic, 2, 1);

    if (selected.length >= targetCount) {
      return selected;
    }
  }

  if (selected.length >= 3) {
    return selected;
  }

  for (const topic of topics.sort((a, b) => getDiversityScore(b) - getDiversityScore(a))) {
    addTopic(topic, targetCount > 6 ? 3 : 2, 2);

    if (selected.length >= targetCount) {
      return selected;
    }
  }

  return selected.slice(0, targetCount);
}

export async function GET(request: NextRequest) {
  try {
    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 6);
    const topicLimit = Math.min(Math.max(requestedLimit, 3), 12);
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from("topics")
      .select(`
        id,
        slug,
        title,
        category,
        hero_image_url,
        heat_score,
        source_count,
        article_count,
        last_article_published_at,
        last_synced_at,
        discovery_mode,
        status
      `)
      .eq("status", "active")
      .not("slug", "is", null)
      .gt("article_count", 0)
      .gt("source_count", 0)
      .order("heat_score", { ascending: false })
      .limit(36);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: `讀取 topics 失敗: ${error.message}`,
        },
        { status: 500 }
      );
    }

    const topics = selectDiverseHomeTopics((data ?? [])
      .map((topic) => ({
        id: topic.id,
        slug: topic.slug,
        title: topic.title,
        category: topic.category ?? "",
        heroImageUrl: topic.hero_image_url ?? "",
        heatScore: topic.heat_score ?? 0,
        sourceCount: topic.source_count ?? 0,
        articleCount: topic.article_count ?? 0,
        updatedAt:
          topic.last_article_published_at ??
          topic.last_synced_at ??
          new Date().toISOString(),
        discoveryMode: topic.discovery_mode ?? "rule_based",
      }))
      .sort((a, b) => {
        if (a.discoveryMode !== b.discoveryMode) {
          return a.discoveryMode === "candidate_cluster" ? -1 : 1;
        }

        const scoreDiff = getDiversityScore(b) - getDiversityScore(a);

        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }), topicLimit);

    return NextResponse.json(
      {
        ok: true,
        selectionMode: "diverse-category-family-v2",
        generatedAt: new Date().toISOString(),
        count: topics.length,
        topics,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤";

    return NextResponse.json(
      {
        ok: false,
        error: `db-home 執行失敗: ${message}`,
      },
      { status: 500 }
    );
  }
}
