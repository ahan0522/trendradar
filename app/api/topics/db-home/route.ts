import { NextResponse } from "next/server";
import { createServiceRoleClient } from "../../../../utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    const topics = (data ?? [])
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
      })
      .slice(0, 6);

    return NextResponse.json(
      {
        ok: true,
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
