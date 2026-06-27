import { getSupabaseAdmin } from "@/lib/supabase-server";
import { mapBeneficiaries } from "@/lib/signals/beneficiary-mapping";
import { detectSignalsFromTopics } from "@/lib/signals/signal-engine";

type EvidencePayload = {
  sample_articles?: Array<{
    id: string;
    title: string;
    source_name: string;
    source_url: string;
    published_at: string | null;
  }>;
};

export async function generateSignalLedger(asOfDate: string) {
  const signals = await detectSignalsFromTopics(asOfDate);
  if (signals.length === 0) {
    return {
      ok: true,
      asOfDate,
      signalCount: 0,
      watchlistCount: 0,
      evidenceCount: 0,
      timelineCount: 0,
      signals: [],
    };
  }

  const supabase = getSupabaseAdmin();
  const watchlists = signals.flatMap((signal) =>
    mapBeneficiaries({
      topic: signal.topic,
      hypothesis: signal.hypothesis,
      signalEventId: signal.id,
    }),
  );
  if (watchlists.length > 0) {
    for (const signal of signals) {
      const { error: cleanupError } = await supabase
        .from("signal_watchlists")
        .delete()
        .eq("signal_event_id", signal.id)
        .eq("source", "rule-based");
      if (cleanupError) throw cleanupError;
    }
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

  const evidenceRows = signals.flatMap((signal) => {
    const payload = (signal.evidence[0] ?? {}) as EvidencePayload;
    return (payload.sample_articles ?? []).map((article) => {
      const evidenceDate = article.published_at?.slice(0, 10) ?? signal.asOfDate;
      const knownAtSignalTime = evidenceDate <= signal.signalDate;
      return {
        id: `${signal.id}-news-${article.id}`,
        signal_event_id: signal.id,
        evidence_date: evidenceDate,
        source_name: article.source_name,
        source_url: article.source_url,
        source_type: knownAtSignalTime ? "news" : "validation_news",
        title: article.title,
        summary: knownAtSignalTime
          ? "訊號形成時已公開的代表文章。"
          : "訊號形成後新增的追蹤資料，不回寫為當時已知資訊。",
        why_it_matters: knownAtSignalTime
          ? "支持跨來源討論正在集中，但不能單獨證明投資假設成立。"
          : "用於驗證原始研究假設是否持續發展，不參與回溯調高初始信心。",
        known_at_signal_time: knownAtSignalTime,
      };
    });
  });
  if (evidenceRows.length > 0) {
    const { error } = await supabase
      .from("signal_evidence_items")
      .upsert(evidenceRows, { onConflict: "id" });
    if (error) throw error;
  }

  const signalTimelineRows = signals.map((signal) => ({
    id: `${signal.id}-created`,
    signal_event_id: signal.id,
    event_date: signal.signalDate,
    event_type: "signal",
    title: `偵測到：${signal.topic}`,
    description: signal.hypothesis,
    known_at_signal_time: true,
    display_order: 0,
  }));
  const evidenceTimelineRows = evidenceRows.map((item, index) => ({
    id: `${item.id}-timeline`,
    signal_event_id: item.signal_event_id,
    event_date: item.evidence_date,
    event_type: item.known_at_signal_time ? "evidence" : "validation",
    title: item.title,
    description: `${item.source_name ?? "未知來源"}：${item.why_it_matters}`,
    source_url: item.source_url,
    known_at_signal_time: true,
    display_order: index + 1,
  }));
  const timelineRows = [...signalTimelineRows, ...evidenceTimelineRows];
  const { error: timelineError } = await supabase
    .from("signal_timeline_events")
    .upsert(timelineRows, { onConflict: "id" });
  if (timelineError) throw timelineError;

  return {
    ok: true,
    asOfDate,
    signalCount: signals.length,
    watchlistCount: watchlists.length,
    evidenceCount: evidenceRows.length,
    timelineCount: timelineRows.length,
    signals,
  };
}
