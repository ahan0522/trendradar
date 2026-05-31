import { NextResponse } from "next/server";
import { getNewsItems } from "@/lib/rss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "全部";
  const q = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? 50);
  const refresh = searchParams.get("refresh") === "1";

  try {
    const items = await getNewsItems({ category, q, limit, refresh });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      count: items.length,
      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        count: 0,
        items: [],
        error: error instanceof Error ? error.message : "Unknown RSS error",
      },
      { status: 500 },
    );
  }
}
