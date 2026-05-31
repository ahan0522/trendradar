import { NextRequest, NextResponse } from "next/server";
import { getNewsItems } from "@/lib/rss";
import { validateTopicGrouping } from "@/lib/topic-validation";

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
        error: "Unauthorized topic validation request",
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 120);

  try {
    const newsItems = await getNewsItems({
      category: "全部",
      q: "",
      limit,
      refresh: true,
    });

    const report = validateTopicGrouping(
      newsItems.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        sourceName: item.sourceName,
        category: item.category,
        link: item.link,
        publishedAt: item.publishedAt,
      }))
    );

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      articleCount: newsItems.length,
      topicCount: report.length,
      report,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown topic validation error",
      },
      { status: 500 }
    );
  }
}
