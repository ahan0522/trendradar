import { NextResponse } from "next/server";
import { getTopicDetailFromDatabase } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }

  try {
    const { id } = await params;
    const detail = await getTopicDetailFromDatabase(id);
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Topic not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...detail });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown topic detail error" },
      { status: 500 },
    );
  }
}
