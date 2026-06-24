import { getSupabaseAdmin } from "@/lib/supabase-server";

export type DerivedSignal = {
  id: string;
  signalDate: string;
  asOfDate: string;
  topic: string;
  signalType: string;
  signalStrength: number;
  confidenceScore: number;
  hypothesis: string;
  evidence: unknown[];
  status: string;
  modelVersion: string;
  watchlistCount: number;
  latestOutcome: null;
  bestOutcome: null;
};

type TopicRow = {
  id: string;
  slug: string | null;
  title: string;
  category: string | null;
  summary: string | null;
  heat_score: number | null;
  source_count: number | null;
  article_count: number | null;
  discovery_mode: string | null;
  last_article_published_at: string | null;
  last_synced_at: string | null;
  updated_at: string | null;
};

function toDate(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function cleanSummary(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifySignalType(topic: TopicRow) {
  const text = `${topic.title} ${topic.category ?? ""}`.toLowerCase();
  if (/ai|人工智慧|晶片|半導體|資料中心|電力|散熱|供應鏈/.test(text)) return "supply_chain";
  if (/股價|價格|漲價|降價|報價|price/.test(text)) return "price";
  return "news";
}

function strength(topic: TopicRow) {
  const heat = Math.min(Number(topic.heat_score ?? 0), 1000) / 10;
  const source = Math.min(Number(topic.source_count ?? 0) * 8, 40);
  const articles = Math.min(Number(topic.article_count ?? 0) * 3, 30);
  return Math.max(0, Math.min(100, Math.round(heat * 0.45 + source * 0.35 + articles * 0.2)));
}

function toSignal(topic: TopicRow): DerivedSignal {
  const signalStrength = strength(topic);
  const date = toDate(topic.last_article_published_at ?? topic.last_synced_at ?? topic.updated_at);
  const summary = cleanSummary(topic.summary);

  return {
    id: `topic-${topic.slug ?? topic.id}`,
    signalDate: date,
    asOfDate: date,
    topic: topic.title,
    signalType: classifySignalType(topic),
    signalStrength,
    confidenceScore: Math.max(35, Math.min(90, signalStrength - 5 + Math.min(Number(topic.source_count ?? 0) * 2, 12))),
    hypothesis:
      summary ||
      `${topic.title} is emerging from current news coverage with ${topic.source_count ?? 0} sources and ${topic.article_count ?? 0} representative articles.`,
    evidence: [
      {
        source: "derived-from-topics",
        topic_id: topic.id,
        slug: topic.slug,
        category: topic.category,
        discovery_mode: topic.discovery_mode,
        heat_score: topic.heat_score,
        source_count: topic.source_count,
        article_count: topic.article_count,
      },
    ],
    status: "active",
    modelVersion: "derived-topic-v1",
    watchlistCount: 0,
    latestOutcome: null,
    bestOutcome: null,
  };
}

export async function getDerivedSignalsFromTopics(limit = 12) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("topics")
    .select("id, slug, title, category, summary, heat_score, source_count, article_count, discovery_mode, last_article_published_at, last_synced_at, updated_at")
    .eq("status", "active")
    .order("heat_score", { ascending: false })
    .limit(limit)
    .returns<TopicRow[]>();

  if (error) throw error;
  return (data ?? []).map(toSignal);
}

export async function getDerivedSignalById(id: string) {
  const signals = await getDerivedSignalsFromTopics(24);
  return signals.find((signal) => signal.id === id) ?? null;
}

export function pendingOutcomes(signalEventId: string) {
  return [7, 14, 30, 60].map((horizon_days) => ({
    signal_event_id: signalEventId,
    horizon_days,
    basket_return: 0,
    benchmark_return: 0,
    excess_return: 0,
    outcome: "pending",
    details: [],
  }));
}

export function emptyStockReturnDetails() {
  return [7, 14, 30, 60].map((horizonDays) => ({ horizonDays, details: [], basketReturn: null }));
}
