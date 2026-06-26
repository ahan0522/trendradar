import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { detectSignalsFromTopics } from "@/lib/signals/signal-engine";
import { mapBeneficiaries } from "@/lib/signals/beneficiary-mapping";
import { requireAdminSecret } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as { asOfDate?: string };
    const asOfDate = body.asOfDate ?? new Date().toISOString().slice(0, 10);
    const signals = await detectSignalsFromTopics(asOfDate);
    const supabase = getSupabaseAdmin();
    const watchlists = signals.flatMap((signal) =>
      mapBeneficiaries({ topic: signal.topic, hypothesis: signal.hypothesis, signalEventId: signal.id }),
    );

    if (watchlists.length > 0) {
      const { error } = await supabase.from("signal_watchlists").upsert(
        watchlists.map((item) => ({
          id: item.id,
          signal_event_id: item.signalEventId,
          symbol: item.symbol,
          company_name: item.companyName,
          market: item.market,
          thesis: item.thesis,
          weight: item.weight,
          source: item.source ?? "rule-based",
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "signal_event_id,symbol,market" },
      );

      if (error) throw error;
    }

    return NextResponse.json({ ok: true, asOfDate, signalCount: signals.length, watchlistCount: watchlists.length, signals });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
