import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCurrentMonthlySignals } from "@/lib/signals/monthly-signals";

type MonthlyEvidence = {
  sample_titles?: string[];
  company_actions?: Array<{
    id: string;
    company_symbol: string;
    company_name: string;
    action_type: string;
    title: string;
    summary?: string | null;
    known_at: string;
    source_url: string;
  }>;
  score_components?: Array<{
    componentName: string;
    rawValue: number;
    normalizedScore: number;
    weight: number;
    contribution: number;
    calculationVersion: string;
    inputSnapshot: Record<string, unknown>;
  }>;
};

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function finalizeMonthlySignals(asOfDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) throw new Error("asOfDate must use YYYY-MM-DD");
  if (asOfDate > currentTaipeiDate()) throw new Error("Cannot finalize a future month");

  const signals = await getCurrentMonthlySignals(asOfDate);
  if (signals.length === 0) {
    return { ok: true, asOfDate, signalCount: 0, watchlistCount: 0, evidenceCount: 0, componentCount: 0 };
  }

  const supabase = getSupabaseAdmin();
  const signalRows = signals.map((signal) => ({
    id: signal.id,
    signal_date: signal.signalDate,
    as_of_date: signal.asOfDate,
    topic: signal.topic,
    signal_type: signal.signalType,
    signal_strength: signal.signalStrength,
    confidence_score: signal.confidenceScore,
    hypothesis: signal.hypothesis,
    evidence: signal.evidence,
    status: "active",
    model_version: "monthly-signal-v2",
    updated_at: new Date().toISOString(),
  }));
  const { error: signalError } = await supabase
    .from("signal_events")
    .upsert(signalRows, { onConflict: "id" });
  if (signalError) throw signalError;

  const watchlistRows = signals.flatMap((signal) =>
    signal.watchlists.map((item) => ({
      id: `${signal.id}-${item.market.toLowerCase()}-${item.symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      signal_event_id: signal.id,
      symbol: item.symbol,
      company_name: item.companyName,
      market: item.market,
      thesis: item.thesis,
      weight: item.weight,
      source: item.source ?? "monthly-rule-based",
      updated_at: new Date().toISOString(),
    })),
  );
  const { error: watchlistError } = await supabase
    .from("signal_watchlists")
    .upsert(watchlistRows, { onConflict: "signal_event_id,symbol,market" });
  if (watchlistError) throw watchlistError;

  const evidenceRows = signals.flatMap((signal) => {
    const evidence = (signal.evidence[0] ?? {}) as MonthlyEvidence;
    const newsRows = (evidence.sample_titles ?? []).map((title, index) => ({
      id: `${signal.id}-news-${index + 1}`,
      signal_event_id: signal.id,
      evidence_date: signal.asOfDate,
      source_name: "monthly-articles",
      source_type: "news",
      title,
      summary: "訊號形成當時已發布的代表文章。",
      why_it_matters: "支持市場討論正在集中，但仍需其他證據交叉驗證。",
      known_at_signal_time: true,
    }));
    const companyRows = (evidence.company_actions ?? []).map((item) => ({
      id: `${signal.id}-company-${item.id}`,
      signal_event_id: signal.id,
      evidence_date: item.known_at.slice(0, 10),
      source_name: item.company_name,
      source_url: item.source_url,
      source_type: "company_action",
      title: `${item.company_symbol}：${item.title}`,
      summary: item.summary ?? null,
      why_it_matters: "正式公司行動可驗證新聞主題是否轉化為企業決策。",
      known_at_signal_time: true,
    }));
    return [...companyRows, ...newsRows];
  });
  if (evidenceRows.length > 0) {
    const { error: evidenceError } = await supabase
      .from("signal_evidence_items")
      .upsert(evidenceRows, { onConflict: "id" });
    if (evidenceError) throw evidenceError;
  }

  const componentRows = signals.flatMap((signal) => {
    const evidence = (signal.evidence[0] ?? {}) as MonthlyEvidence;
    return (evidence.score_components ?? []).map((item) => ({
      signal_event_id: signal.id,
      component_name: item.componentName,
      raw_value: item.rawValue,
      normalized_score: item.normalizedScore,
      weight: item.weight,
      contribution: item.contribution,
      calculation_version: item.calculationVersion,
      input_snapshot: item.inputSnapshot,
      calculated_at: `${signal.asOfDate}T23:59:59.000Z`,
    }));
  });
  if (componentRows.length > 0) {
    const { error: componentError } = await supabase
      .from("signal_score_components")
      .upsert(componentRows, { onConflict: "signal_event_id,component_name" });
    if (componentError) throw componentError;
  }

  return {
    ok: true,
    asOfDate,
    signalCount: signalRows.length,
    watchlistCount: watchlistRows.length,
    evidenceCount: evidenceRows.length,
    componentCount: componentRows.length,
  };
}

export function previousMonthEnd(date = new Date()) {
  const taipei = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  return new Date(Date.UTC(taipei.getFullYear(), taipei.getMonth(), 0)).toISOString().slice(0, 10);
}
