import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { SignalEvent, SignalType } from "@/types/signals";

export type SignalStrengthInput = {
  mentionSpike?: number;
  priceSpike?: number;
  sourceDiversity?: number;
  persistence?: number;
  companyActivity?: number;
  beneficiaryClarity?: number;
};

export type SignalConvictionStatus = "high_conviction" | "rising" | "watch" | "weak";

export type SignalScoreComponent = {
  componentName: keyof SignalStrengthInput;
  rawValue: number;
  normalizedScore: number;
  weight: number;
  contribution: number;
  calculationVersion: string;
  inputSnapshot: Record<string, unknown>;
};

type ArticleRow = {
  id: string;
  title: string;
  source_name: string;
  published_at: string | null;
};

type TopicArticleRow = {
  topic_id: string;
  article_id: string;
  created_at: string;
};

type TopicRow = {
  id: string;
  title: string;
  category: string;
  region: string;
  summary: string | null;
  trend_score: number;
  first_seen_at: string;
};

type SignalEventRow = {
  id: string;
  signal_date: string;
  as_of_date: string;
  topic: string;
  signal_type: SignalType;
  signal_strength: number;
  confidence_score: number;
  hypothesis: string;
  evidence: unknown[];
  status: "active" | "validated" | "partial" | "failed";
  model_version: string | null;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function daysBefore(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function assertAsOfNotFuture(asOfDate: string, today = currentTaipeiDate()) {
  asOfEndIso(asOfDate);
  if (asOfDate > today) throw new Error("asOfDate cannot be in the future");
}

export function asOfEndIso(asOfDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) throw new Error("asOfDate must use YYYY-MM-DD");
  const [year, month, day] = asOfDate.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.toISOString().slice(0, 10) !== asOfDate) throw new Error("Invalid asOfDate");
  const parsed = new Date(`${asOfDate}T23:59:59.999+08:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid asOfDate");
  return parsed.toISOString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function mapSignalRow(row: SignalEventRow): SignalEvent {
  return {
    id: row.id,
    signalDate: row.signal_date,
    asOfDate: row.as_of_date,
    topic: row.topic,
    signalType: row.signal_type,
    signalStrength: Number(row.signal_strength),
    confidenceScore: Number(row.confidence_score),
    hypothesis: row.hypothesis,
    evidence: row.evidence,
    status: row.status,
    modelVersion: row.model_version ?? undefined,
  };
}

export function calculateSignalStrength(input: SignalStrengthInput) {
  const score =
    (input.mentionSpike ?? 0) * 0.2 +
    (input.priceSpike ?? 0) * 0.25 +
    (input.sourceDiversity ?? 0) * 0.15 +
    (input.persistence ?? 0) * 0.15 +
    (input.companyActivity ?? 0) * 0.1 +
    (input.beneficiaryClarity ?? 0) * 0.15;

  return clampScore(score);
}

export function buildSignalScoreComponents(
  input: SignalStrengthInput,
  rawInput: Record<string, unknown> = {},
): SignalScoreComponent[] {
  const weights: Record<keyof SignalStrengthInput, number> = {
    mentionSpike: 0.2,
    priceSpike: 0.25,
    sourceDiversity: 0.15,
    persistence: 0.15,
    companyActivity: 0.1,
    beneficiaryClarity: 0.15,
  };

  return (Object.keys(weights) as Array<keyof SignalStrengthInput>).map((componentName) => {
    const normalizedScore = clampScore(input[componentName] ?? 0);
    const weight = weights[componentName];
    return {
      componentName,
      rawValue: Number(input[componentName] ?? 0),
      normalizedScore,
      weight,
      contribution: Number((normalizedScore * weight).toFixed(2)),
      calculationVersion: "signal-strength-v1",
      inputSnapshot: rawInput,
    };
  });
}

export function classifySignalStatus(score: number): SignalConvictionStatus {
  if (score >= 85) return "high_conviction";
  if (score >= 70) return "rising";
  if (score >= 50) return "watch";
  return "weak";
}

export async function detectSignalsFromTopics(asOfDate: string) {
  const supabase = getSupabaseAdmin();
  assertAsOfNotFuture(asOfDate);
  const asOfIso = asOfEndIso(asOfDate);
  const asOf = new Date(asOfIso);
  const since30d = daysBefore(asOf, 30).toISOString();
  const since7d = daysBefore(asOf, 7).toISOString();
  const since24h = daysBefore(asOf, 1).toISOString();

  const [{ data: topics, error: topicsError }, { data: articleLinks, error: linksError }, { data: articles, error: articlesError }] =
    await Promise.all([
      supabase
        .from("topics")
        .select("id, title, category, region, summary, trend_score, first_seen_at")
        .lte("first_seen_at", asOfIso)
        .returns<TopicRow[]>(),
      supabase
        .from("topic_articles")
        .select("topic_id, article_id, created_at")
        .lte("created_at", asOfIso)
        .returns<TopicArticleRow[]>(),
      supabase
        .from("articles")
        .select("id, title, source_name, published_at")
        .lte("published_at", asOfIso)
        .gte("published_at", since30d)
        .returns<ArticleRow[]>(),
    ]);

  if (topicsError) throw topicsError;
  if (linksError) throw linksError;
  if (articlesError) throw articlesError;

  const topicById = new Map((topics ?? []).map((topic) => [topic.id, topic]));
  const articleById = new Map((articles ?? []).map((article) => [article.id, article]));
  const grouped = new Map<string, ArticleRow[]>();

  for (const link of articleLinks ?? []) {
    const article = articleById.get(link.article_id);
    if (!article) continue;
    const current = grouped.get(link.topic_id) ?? [];
    current.push(article);
    grouped.set(link.topic_id, current);
  }

  const rows: Array<Omit<SignalEventRow, "model_version"> & {
    model_version: string;
    scoreComponents: SignalScoreComponent[];
  }> = [];

  for (const [topicId, topicArticles] of grouped) {
    const topic = topicById.get(topicId);
    if (!topic) continue;

    const articleCount24h = topicArticles.filter((article) => article.published_at && article.published_at >= since24h).length;
    const articleCount7d = topicArticles.filter((article) => article.published_at && article.published_at >= since7d).length;
    const articleCount30d = topicArticles.length;
    const sourceCount = new Set(topicArticles.map((article) => article.source_name)).size;
    const expected7d = Math.max(articleCount30d * (7 / 30), 1);
    const mentionSpike = Number((articleCount7d / expected7d).toFixed(2));

    if (articleCount7d < 5 || sourceCount < 3 || mentionSpike < 2) continue;

    const scoreInput = {
      mentionSpike: Math.min(mentionSpike * 20, 100),
      sourceDiversity: Math.min(sourceCount * 15, 100),
      persistence: Math.min(articleCount7d * 10, 100),
      beneficiaryClarity: 55,
    };
    const signalStrength = calculateSignalStrength(scoreInput);
    const scoreComponents = buildSignalScoreComponents(scoreInput, {
      article_count_24h: articleCount24h,
      article_count_7d: articleCount7d,
      article_count_30d: articleCount30d,
      source_count: sourceCount,
      mention_spike: mentionSpike,
    });

    rows.push({
      id: `auto-${asOfDate}-${slugify(topic.title)}`,
      signal_date: asOfDate,
      as_of_date: asOfDate,
      topic: topic.title,
      signal_type: "news",
      signal_strength: signalStrength,
      confidence_score: clampScore(signalStrength * 0.85),
      hypothesis: topic.summary || `${topic.title} is showing abnormal cross-source news momentum before ${asOfDate}.`,
      evidence: [
        {
          topicId,
          category: topic.category,
          region: topic.region,
          article_count_24h: articleCount24h,
          article_count_7d: articleCount7d,
          article_count_30d: articleCount30d,
          source_count: sourceCount,
          mention_spike: mentionSpike,
          sample_titles: topicArticles.slice(0, 5).map((article) => article.title),
          conviction: classifySignalStatus(signalStrength),
        },
      ],
      status: "active",
      model_version: "rule-v1",
      scoreComponents,
    });
  }

  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from("signal_events")
    .upsert(rows.map(({ scoreComponents, ...row }) => {
      void scoreComponents;
      return row;
    }), { onConflict: "id" })
    .select("id, signal_date, as_of_date, topic, signal_type, signal_strength, confidence_score, hypothesis, evidence, status, model_version")
    .returns<SignalEventRow[]>();

  if (error) throw error;

  const componentRows = rows.flatMap((row) =>
    row.scoreComponents.map((component) => ({
      signal_event_id: row.id,
      component_name: component.componentName,
      raw_value: component.rawValue,
      normalized_score: component.normalizedScore,
      weight: component.weight,
      contribution: component.contribution,
      calculation_version: component.calculationVersion,
      input_snapshot: component.inputSnapshot,
      calculated_at: new Date().toISOString(),
    })),
  );
  if (componentRows.length > 0) {
    const { error: componentError } = await supabase
      .from("signal_score_components")
      .upsert(componentRows, { onConflict: "signal_event_id,component_name" });
    if (componentError && componentError.code !== "42P01") throw componentError;
  }

  return (data ?? []).map(mapSignalRow);
}
