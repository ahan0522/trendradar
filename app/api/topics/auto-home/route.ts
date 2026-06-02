import { NextResponse } from "next/server";
import { getNewsItems } from "@/lib/rss";
import { discoverCandidateTopics } from "@/lib/topic-candidates";
import { groupArticlesToHomepageTopics } from "@/lib/topic-grouping";
import { getHeroImageForCategory } from "@/lib/topic-home";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const newsItems = await getNewsItems({
      category: "全部",
      q: "",
      limit: 240,
      refresh: true,
    });

    const articles = newsItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      sourceName: item.sourceName,
      category: item.category,
      sourcePool: item.sourcePool,
      sourceKind: item.sourceKind,
      sourceTier: item.sourceTier,
      sourceWeight: item.sourceWeight,
      credibilityWeight: item.credibilityWeight,
      sourceRole: item.sourceRole,
      link: item.link,
      publishedAt: item.publishedAt,
    }));

    const candidateTopics = discoverCandidateTopics(articles, {
      maxTopics: 8,
      minArticles: 2,
    });

    const publishableCandidates = candidateTopics
      .filter((topic) => topic.publishable)
      .sort((a, b) => {
        if (b.qualityScore !== a.qualityScore) {
          return b.qualityScore - a.qualityScore;
        }

        return b.heatScore - a.heatScore;
      })
      .map((topic) => ({
        id: topic.id,
        slug: topic.slug,
        title: topic.title,
        category: topic.category,
        heroImageUrl: getHeroImageForCategory(topic.category),
        heatScore: topic.heatScore,
        sourceCount: topic.sourceCount,
        articleCount: topic.articleCount,
        updatedAt: topic.latestPublishedAt,
        summary: topic.summary,
        discoveryMode: "candidate_cluster",
        qualityScore: topic.qualityScore,
      }));

    const usedTitles = new Set(
      publishableCandidates.map((topic) => topic.title.toLowerCase())
    );
    const ruleTopics = groupArticlesToHomepageTopics(articles)
      .filter((topic) => !usedTitles.has(topic.title.toLowerCase()))
      .map((topic) => ({
        ...topic,
        summary: "",
        discoveryMode: "rule_based",
        qualityScore: null,
      }));

    const topics = [
      ...publishableCandidates.slice(0, 6),
      ...ruleTopics.slice(0, Math.max(0, 6 - publishableCandidates.length)),
    ].slice(0, 6);

    return NextResponse.json({
      ok: true,
      mode: "auto-home-preview",
      generatedAt: new Date().toISOString(),
      articleCount: newsItems.length,
      candidateCount: candidateTopics.length,
      publishableCandidateCount: publishableCandidates.length,
      ruleFallbackCount: topics.filter((topic) => topic.discoveryMode === "rule_based")
        .length,
      count: topics.length,
      topics,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown auto-home error",
      },
      { status: 500 }
    );
  }
}
