import { NextResponse } from "next/server";
import { rssSources } from "@/data/rss-sources";
import { getNewsItems } from "@/lib/rss";
import {
  getSourcePoolLabel,
  getSourceTierLabel,
  summarizeSourcePools,
} from "@/lib/source-scoring";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const items = await getNewsItems({
      category: "全部",
      q: "",
      limit: 300,
      refresh: true,
    });

    const itemCountBySource = new Map<string, number>();
    items.forEach((item) => {
      itemCountBySource.set(
        item.sourceId,
        (itemCountBySource.get(item.sourceId) ?? 0) + 1
      );
    });

    const sources = rssSources.map((source) => ({
      id: source.id,
      name: source.name,
      enabled: source.enabled,
      category: source.category,
      region: source.region,
      sourcePool: source.sourcePool,
      sourcePoolLabel: getSourcePoolLabel(source.sourcePool),
      sourceKind: source.sourceKind,
      sourceTier: source.sourceTier,
      sourceTierLabel: getSourceTierLabel(source.sourceTier),
      sourceWeight: source.sourceWeight ?? 1,
      credibilityWeight: source.credibilityWeight ?? 1,
      role: source.role,
      itemCount: itemCountBySource.get(source.id) ?? 0,
    }));

    const sourcePoolSummary = summarizeSourcePools(items).map(([label, count]) => ({
      label,
      count,
    }));

    const sourceTierSummary = items.reduce((summary, item) => {
      const label = getSourceTierLabel(item.sourceTier);
      summary.set(label, (summary.get(label) ?? 0) + 1);
      return summary;
    }, new Map<string, number>());

    return NextResponse.json(
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        sourceCount: rssSources.length,
        enabledSourceCount: rssSources.filter((source) => source.enabled).length,
        itemCount: items.length,
        sourcePoolSummary,
        sourceTierSummary: [...sourceTierSummary.entries()].map(([label, count]) => ({
          label,
          count,
        })),
        sources,
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
        error: `sources health 執行失敗: ${message}`,
      },
      { status: 500 }
    );
  }
}
