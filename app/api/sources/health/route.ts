import { NextResponse } from "next/server";
import { rssSources } from "@/data/rss-sources";
import { getNewsItems } from "@/lib/rss";
import {
  getSourcePoolLabel,
  getSourceTierLabel,
  isPlatformSourceName,
  summarizeSourcePools,
} from "@/lib/source-scoring";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const items = await getNewsItems({
      category: "全部",
      q: "",
      limit: 1000,
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
    const enabledSources = rssSources.filter((source) => source.enabled);
    const zeroItemEnabledSources = sources.filter(
      (source) => source.enabled && source.itemCount === 0
    );
    const emptyDescriptionCount = items.filter(
      (item) => !item.description || item.description.trim().length === 0
    ).length;
    const platformItemCount = items.filter((item) =>
      isPlatformSourceName(item.sourceName)
    ).length;
    const platformRatio =
      items.length > 0 ? Number((platformItemCount / items.length).toFixed(3)) : 0;
    const healthStatus =
      zeroItemEnabledSources.length >= Math.max(3, enabledSources.length * 0.25)
        ? {
            level: "warning",
            label: "部分來源需要檢查",
            description: "有多個啟用來源本輪沒有抓到文章，建議檢查 RSS 是否改版或暫時失效。",
          }
        : platformRatio > 0.25
          ? {
              level: "warning",
              label: "平台聚合偏高",
              description: "平台型來源比例偏高，摘要仍可用，但需要補更多原始媒體來源。",
            }
          : {
              level: "healthy",
              label: "來源池正常",
              description: "目前來源抓取、摘要欄位與平台比例都在可接受範圍。",
            };

    return NextResponse.json(
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        sourceCount: rssSources.length,
        enabledSourceCount: enabledSources.length,
        itemCount: items.length,
        emptyDescriptionCount,
        platformItemCount,
        platformRatio,
        zeroItemEnabledSourceCount: zeroItemEnabledSources.length,
        zeroItemEnabledSources: zeroItemEnabledSources.map((source) => ({
          id: source.id,
          name: source.name,
          category: source.category,
          region: source.region,
        })),
        healthStatus,
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
