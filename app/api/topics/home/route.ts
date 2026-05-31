import { NextResponse } from "next/server";
import { mockTopicCards } from "@/data/mock-topic-cards";

export async function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: mockTopicCards.length,
    topics: mockTopicCards,
  });
}