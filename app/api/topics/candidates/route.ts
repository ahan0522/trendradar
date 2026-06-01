import { NextRequest, NextResponse } from "next/server";
import { getNewsItems } from "@/lib/rss";
import { discoverCandidateTopics } from "@/lib/topic-candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const token = process.env.CRON_SECRET;

  if (!token) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${token}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized candidate topic request",
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 120);
  const maxTopics = Number(searchParams.get("maxTopics") ?? 6);

  try {
    const newsItems = await getNewsItems({
      category: "全部",
      q: "",
      limit,
      refresh: true,
    });

    const candidates = discoverCandidateTopics(
      newsItems.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        sourceName: item.sourceName,
        category: item.category,
        link: item.link,
        publishedAt: item.publishedAt,
      })),
      {
        maxTopics,
        minArticles: 2,
      }
    );

    return NextResponse.json({
      ok: true,
      mode: "candidate-topic-clustering",
      generatedAt: new Date().toISOString(),
      articleCount: newsItems.length,
      candidateCount: candidates.length,
      publishableCount: candidates.filter((candidate) => candidate.publishable).length,
      candidates,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown candidate topic error",
      },
      { status: 500 }
    );
  }
}
