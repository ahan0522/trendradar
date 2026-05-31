import { NextRequest, NextResponse } from "next/server";
import { mockTopicDetails } from "@/data/mock-topic-cards";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const topic = mockTopicDetails[slug];

  if (!topic) {
    return NextResponse.json({ ok: false, error: "Topic not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, topic });
}