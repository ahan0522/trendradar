import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import {
  createPublicationDraft,
  listLatestPublicationReviews,
} from "@/lib/signals/publication-review";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json({ ok: true, reviews: await listLatestPublicationReviews() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to load reviews" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as { signalEventId?: string };
    if (!body.signalEventId) {
      return NextResponse.json({ ok: false, error: "signalEventId is required" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      review: await createPublicationDraft(body.signalEventId),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to evaluate signal" },
      { status: 500 },
    );
  }
}
