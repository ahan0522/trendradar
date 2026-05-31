import { NextResponse } from "next/server";
import { getArticlesFromDatabase } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "全部";
  const q = searchParams.get("q") ?? "";
  const region = searchParams.get("region") ?? "全部";
  const limit = Number(searchParams.get("limit") ?? 50);

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        mode: "db-not-configured",
        count: 0,
        items: [],
        hint: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run /api/sync.",
      },
      { status: 503 },
    );
  }

  try {
    const items = await getArticlesFromDatabase({ category, q, region, limit });
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      mode: "supabase-db",
      count: items.length,
      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        mode: "db-error",
        error: error instanceof Error ? error.message : "Unknown database article error",
        items: [],
      },
      { status: 500 },
    );
  }
}
