import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { getPublicationFeed } from "@/lib/signals/publication-feed";
import type { SignalPublicationPeriod } from "@/types/signals";

const periods = new Set<SignalPublicationPeriod>(["daily", "weekly", "monthly"]);

export async function GET(request: NextRequest) {
  const requestedPeriod = request.nextUrl.searchParams.get("period") ?? "monthly";
  if (!periods.has(requestedPeriod as SignalPublicationPeriod)) {
    return NextResponse.json(
      { ok: false, error: "period must be daily, weekly, or monthly" },
      { status: 400 },
    );
  }

  const includeApproved = request.nextUrl.searchParams.get("includeApproved") === "true";
  if (includeApproved) {
    const unauthorized = requireAdminSecret(request);
    if (unauthorized) return unauthorized;
  }

  try {
    const feed = await getPublicationFeed({
      period: requestedPeriod as SignalPublicationPeriod,
      includeApproved,
    });
    return NextResponse.json({
      ok: true,
      visibility: includeApproved ? "internal-preview" : "public",
      generatedAt: new Date().toISOString(),
      ...feed,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to build publication feed" },
      { status: 500 },
    );
  }
}
