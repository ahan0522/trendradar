import { NextResponse } from "next/server";
import { mockTopics } from "@/data/mock-topics";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "全部";
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const topics = mockTopics.filter((topic) => {
    const matchCategory = category === "全部" || topic.category === category;
    const matchQuery =
      !q ||
      topic.title.toLowerCase().includes(q) ||
      topic.category.toLowerCase().includes(q) ||
      topic.region.toLowerCase().includes(q) ||
      topic.summary.toLowerCase().includes(q) ||
      topic.sources.join(" ").toLowerCase().includes(q);

    return matchCategory && matchQuery;
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: topics.length,
    topics,
  });
}
