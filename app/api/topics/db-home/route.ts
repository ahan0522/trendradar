import { NextResponse } from "next/server";
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

function selectDiverseHomeTopics(topics: HomeTopic[]) {
  const selected: HomeTopic[] = [];
  const categoryCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();

  for (const topic of topics) {
    const categoryCount = categoryCounts.get(topic.category) ?? 0;
    const family = getTopicFamily(topic);
    const familyCount = familyCounts.get(family) ?? 0;

    if (categoryCount >= 2 || familyCount >= 1) {
      continue;
    }

    selected.push(topic);
    categoryCounts.set(topic.category, categoryCount + 1);
    familyCounts.set(family, familyCount + 1);

    if (selected.length >= 6) {
      return selected;
    }
  }

  const minimumTopicCount = Math.min(3, topics.length);

  if (selected.length < minimumTopicCount) {
    for (const topic of topics) {
      if (selected.some((item) => item.id === topic.id)) {
        continue;
      }

      selected.push(topic);

      if (selected.length >= minimumTopicCount) {
        break;
      }
    }
  }

  return selected.slice(0, 6);
}

export async function GET() {
  try {
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
      .gt("source_count", 1)
      .order("heat_score", { ascending: false })
      .limit(12);

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

        if (b.heatScore !== a.heatScore) {
          return b.heatScore - a.heatScore;
        }

        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }));

    return NextResponse.json(
      {
        ok: true,
        selectionMode: "diverse-category-family-v1",
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
