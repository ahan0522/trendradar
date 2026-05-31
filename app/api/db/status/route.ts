import { NextResponse } from "next/server";
import { getDatabaseStatus } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      lastSyncedAt: null,
      topicCount: 0,
      articleCount: 0,
      hint: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run /api/sync.",
    }, { status: 503 });
  }

  try {
    const status = await getDatabaseStatus();
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      ...status,
    });
  } catch (error) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      configured: true,
      error: error instanceof Error ? error.message : "Unknown database status error",
    }, { status: 500 });
  }
}
