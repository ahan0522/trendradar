import { NextResponse } from "next/server";
import { syncRssToDatabase } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const token = process.env.CRON_SECRET;
  if (!token) return false;

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const urlToken = new URL(request.url).searchParams.get("secret");
  return bearer === token || urlToken === token;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") !== "0";
  const limit = Number(searchParams.get("limit") ?? 150);

  try {
    const result = await syncRssToDatabase({ refresh, limit });
    return NextResponse.json({ ok: true, mode: "vercel-cron-sync", ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown cron sync error",
      },
      { status: 500 },
    );
  }
}
