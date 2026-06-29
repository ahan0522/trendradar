import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { transitionPublicationReview } from "@/lib/signals/publication-review";
import type { SignalPublicationStatus } from "@/types/signals";

const allowed = new Set<SignalPublicationStatus>([
  "draft",
  "reviewed",
  "approved",
  "rejected",
  "published",
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: SignalPublicationStatus;
      reviewNote?: string;
      reviewedBy?: string;
    };
    if (!body.status || !allowed.has(body.status)) {
      return NextResponse.json({ ok: false, error: "Valid status is required" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      review: await transitionPublicationReview({
        signalEventId: id,
        status: body.status,
        reviewNote: body.reviewNote,
        reviewedBy: body.reviewedBy,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to transition review" },
      { status: 400 },
    );
  }
}
