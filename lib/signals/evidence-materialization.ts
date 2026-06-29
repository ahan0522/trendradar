import { getSupabaseAdmin } from "@/lib/supabase-server";

type SignalRow = { id: string; as_of_date: string; topic: string; hypothesis: string };
type WatchRow = { signal_event_id: string; symbol: string; market: string };
type IndustryRow = { id: string; industry: string; metric_name: string; metric_value: number | null; metric_text: string | null; unit: string | null; known_at: string; source_id: string | null; source_url: string };
type CommodityRow = { id: string; commodity_code: string; commodity_name: string; quote_date: string; price: number; currency: string; unit: string; known_at: string; source_id: string | null; source_url: string };
type CompanyRow = { id: string; company_symbol: string; market: string; company_name: string; action_type: string; title: string; summary: string | null; known_at: string; source_id: string | null; source_url: string };

function normalized(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ");
}

export function researchEvidenceRelevance(
  topic: string,
  kind: "industry" | "commodity",
  name: string,
) {
  const signal = normalized(topic);
  const metric = normalized(name);
  if (kind === "industry") {
    return /半導體|晶片|記憶體|hbm|dram|nand|ai|算力|資料中心|compute|semiconductor/.test(signal)
      && /半導體|運算|高科技|compute|semiconductor/.test(metric);
  }
  if (/天然氣|henry hub|gas/.test(metric)) {
    return /能源|天然氣|發電|電力|資料中心|power|energy|gas/.test(signal);
  }
  if (/銅|copper/.test(metric)) {
    return /電網|電力|變壓器|資料中心|基礎建設|power|grid|copper/.test(signal);
  }
  return false;
}

function lookbackStart(asOfDate: string) {
  const date = new Date(`${asOfDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 120);
  return date.toISOString();
}

export async function materializeSignalResearchEvidence(signalEventId?: string) {
  const supabase = getSupabaseAdmin();
  let signalQuery = supabase
    .from("signal_events")
    .select("id, as_of_date, topic, hypothesis")
    .order("as_of_date", { ascending: false });
  if (signalEventId) signalQuery = signalQuery.eq("id", signalEventId);
  const { data: signals, error: signalError } = await signalQuery.returns<SignalRow[]>();
  if (signalError) throw signalError;
  const signalIds = (signals ?? []).map((item) => item.id);
  if (signalIds.length === 0) return { ok: true, signalCount: 0, evidenceCount: 0 };

  const { data: watchlists, error: watchlistError } = await supabase
    .from("signal_watchlists")
    .select("signal_event_id, symbol, market")
    .in("signal_event_id", signalIds)
    .returns<WatchRow[]>();
  if (watchlistError) throw watchlistError;

  const evidenceRows: Array<Record<string, unknown>> = [];
  for (const signal of signals ?? []) {
    const start = lookbackStart(signal.as_of_date);
    const end = `${signal.as_of_date}T23:59:59.999Z`;
    const watches = (watchlists ?? []).filter((item) => item.signal_event_id === signal.id);
    const symbols = [...new Set(watches.map((item) => item.symbol))];
    const [industryResult, commodityResult, companyResult] = await Promise.all([
      supabase.from("industry_observations")
        .select("id, industry, metric_name, metric_value, metric_text, unit, known_at, source_id, source_url")
        .eq("quality_status", "verified").gte("known_at", start).lte("known_at", end)
        .order("known_at", { ascending: false }).returns<IndustryRow[]>(),
      supabase.from("commodity_quotes")
        .select("id, commodity_code, commodity_name, quote_date, price, currency, unit, known_at, source_id, source_url")
        .eq("quality_status", "verified").gte("known_at", start).lte("known_at", end)
        .order("known_at", { ascending: false }).returns<CommodityRow[]>(),
      symbols.length
        ? supabase.from("company_actions")
            .select("id, company_symbol, market, company_name, action_type, title, summary, known_at, source_id, source_url")
            .eq("quality_status", "verified").in("company_symbol", symbols)
            .gte("known_at", start).lte("known_at", end)
            .order("known_at", { ascending: false }).returns<CompanyRow[]>()
        : Promise.resolve({ data: [] as CompanyRow[], error: null }),
    ]);
    if (industryResult.error) throw industryResult.error;
    if (commodityResult.error) throw commodityResult.error;
    if (companyResult.error) throw companyResult.error;

    const signalText = `${signal.topic} ${signal.hypothesis}`;
    const industries = new Map<string, IndustryRow>();
    for (const item of industryResult.data ?? []) {
      if (researchEvidenceRelevance(signalText, "industry", `${item.industry} ${item.metric_name}`) && !industries.has(item.metric_name)) {
        industries.set(item.metric_name, item);
      }
    }
    const commodities = new Map<string, CommodityRow>();
    for (const item of commodityResult.data ?? []) {
      if (researchEvidenceRelevance(signalText, "commodity", `${item.commodity_code} ${item.commodity_name}`) && !commodities.has(item.commodity_code)) {
        commodities.set(item.commodity_code, item);
      }
    }

    for (const item of industries.values()) evidenceRows.push({
      id: `${signal.id}-industry-${item.id}`, signal_event_id: signal.id,
      evidence_date: item.known_at.slice(0, 10), source_name: item.source_id ?? "verified-industry-source",
      source_url: item.source_url, source_type: "industry",
      title: `${item.metric_name}：${item.metric_value ?? item.metric_text ?? "-"} ${item.unit ?? ""}`.trim(),
      summary: `產業分類：${item.industry}`,
      why_it_matters: "用合法原始產業資料檢查新聞敘事是否有實體活動支持。",
      known_at_signal_time: true,
    });
    for (const item of commodities.values()) evidenceRows.push({
      id: `${signal.id}-commodity-${item.id}`, signal_event_id: signal.id,
      evidence_date: item.known_at.slice(0, 10), source_name: item.source_id ?? "verified-commodity-source",
      source_url: item.source_url, source_type: "commodity",
      title: `${item.commodity_name}：${item.price} ${item.currency}/${item.unit}`,
      summary: `觀測日期 ${item.quote_date}，資料序列 ${item.commodity_code}。`,
      why_it_matters: "商品與成本資料用於支持或反駁供需假設，不代表個股買賣訊號。",
      known_at_signal_time: true,
    });
    for (const item of companyResult.data ?? []) {
      if (!watches.some((watch) => watch.symbol === item.company_symbol && watch.market === item.market)) continue;
      evidenceRows.push({
        id: `${signal.id}-company-${item.id}`, signal_event_id: signal.id,
        evidence_date: item.known_at.slice(0, 10), source_name: item.source_id ?? item.company_name,
        source_url: item.source_url, source_type: "company_action",
        title: `${item.company_symbol}：${item.title}`, summary: item.summary,
        why_it_matters: `正式 ${item.action_type} 資訊可驗證觀察標的是否出現實際企業行動。`,
        known_at_signal_time: true,
      });
    }
  }
  if (evidenceRows.length) {
    const { error } = await supabase.from("signal_evidence_items").upsert(evidenceRows, { onConflict: "id" });
    if (error) throw error;
  }
  return { ok: true, signalCount: signalIds.length, evidenceCount: evidenceRows.length };
}
