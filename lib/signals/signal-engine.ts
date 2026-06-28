import { getSupabaseAdmin } from "@/lib/supabase-server";
import { mapBeneficiaries } from "@/lib/signals/beneficiary-mapping";
import type { SignalEvent, SignalType } from "@/types/signals";

export type SignalStrengthInput = {
  mentionSpike?: number;
  priceSpike?: number;
  sourceDiversity?: number;
  persistence?: number;
  companyActivity?: number;
  beneficiaryClarity?: number;
};

export type SignalHeatInput = {
  mentionSpike?: number;
  velocity?: number;
  articleVolume?: number;
  sourceDiversity?: number;
  persistence?: number;
};

export type ResearchConfidenceInput = {
  sourceQuality?: number;
  sourceDiversity?: number;
  evidenceDepth?: number;
  persistence?: number;
  companyActivity?: number;
  beneficiaryClarity?: number;
  priceConfirmation?: number;
  contradictionPenalty?: number;
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
  link: string;
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

type ExistingSignalRow = {
  id: string;
  signal_date: string;
  topic: string;
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

export function calculateSignalHeat(input: SignalHeatInput) {
  const score =
    (input.mentionSpike ?? 0) * 0.3 +
    (input.velocity ?? 0) * 0.25 +
    (input.articleVolume ?? 0) * 0.15 +
    (input.sourceDiversity ?? 0) * 0.15 +
    (input.persistence ?? 0) * 0.15;
  return clampScore(score);
}

export function calculateResearchConfidence(input: ResearchConfidenceInput) {
  const score =
    (input.sourceQuality ?? 0) * 0.25 +
    (input.sourceDiversity ?? 0) * 0.15 +
    (input.evidenceDepth ?? 0) * 0.15 +
    (input.persistence ?? 0) * 0.15 +
    (input.companyActivity ?? 0) * 0.1 +
    (input.beneficiaryClarity ?? 0) * 0.1 +
    (input.priceConfirmation ?? 0) * 0.1 -
    (input.contradictionPenalty ?? 0) * 0.2;
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

export function selectHighestConviction<
  T extends { signal_strength: number; confidence_score: number },
>(rows: T[], limit = 3) {
  return [...rows]
    .sort((a, b) => b.signal_strength - a.signal_strength || b.confidence_score - a.confidence_score)
    .slice(0, Math.max(0, limit));
}

export function buildEvidenceBasedHypothesis(topicTitle: string, sourceCount: number) {
  const prefix = `截至研究時點，已有 ${sourceCount} 個獨立來源聚焦「${topicTitle}」。`;
  if (/cpo|co-packaged optics|面板級封裝|矽光子|光通訊/i.test(topicTitle)) {
    return `${prefix} 研究重點是 CPO、矽光子與封裝量產進度，是否進一步獲得客戶採用、公司公告及營收結構驗證。`;
  }
  if (/cowos|先進封裝|封裝/i.test(topicTitle)) {
    return `${prefix} 研究重點是先進封裝產能是否持續成為 AI 晶片供應瓶頸，以及設備與封測需求能否被公司行動驗證。`;
  }
  if (/hbm|dram|nand|記憶體/i.test(topicTitle)) {
    return `${prefix} 研究重點是需求、產能配置與報價是否同步變化，並由供應商公告及可靠價格資料交叉驗證。`;
  }
  if (/電力|電網|變壓器|資料中心電源/i.test(topicTitle)) {
    return `${prefix} 研究重點是 AI 基礎建設瓶頸是否轉向供電、電網與電力設備，並反映在訂單及資本支出。`;
  }
  return `${prefix} 這仍是早期候選，需等待公司公告、產業數據與可靠價格資料確認是否形成可持續市場趨勢。`;
}

export function resolveSignalIdentity(
  topic: string,
  asOfDate: string,
  existingSignals: ExistingSignalRow[],
) {
  const normalizedTopic = topic.trim().toLocaleLowerCase();
  const existing = existingSignals.find(
    (signal) =>
      signal.signal_date <= asOfDate &&
      signal.topic.trim().toLocaleLowerCase() === normalizedTopic,
  );

  return existing
    ? { id: existing.id, signalDate: existing.signal_date, isNew: false }
    : {
        id: `auto-${asOfDate}-${slugify(topic)}`,
        signalDate: asOfDate,
        isNew: true,
      };
}

export async function detectSignalsFromTopics(asOfDate: string) {
  const supabase = getSupabaseAdmin();
  assertAsOfNotFuture(asOfDate);
  const asOfIso = asOfEndIso(asOfDate);
  const asOf = new Date(asOfIso);
  const since30d = daysBefore(asOf, 30).toISOString();
  const since7d = daysBefore(asOf, 7).toISOString();
  const since24h = daysBefore(asOf, 1).toISOString();

  const [
    { data: topics, error: topicsError },
    { data: articleLinks, error: linksError },
    { data: existingSignals, error: existingSignalsError },
  ] =
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
        .from("signal_events")
        .select("id, signal_date, topic")
        .lte("signal_date", asOfDate)
        .order("signal_date", { ascending: true })
        .returns<ExistingSignalRow[]>(),
    ]);

  if (topicsError) throw topicsError;
  if (linksError) throw linksError;
  if (existingSignalsError) throw existingSignalsError;

  const linkedArticleIds = [...new Set((articleLinks ?? []).map((link) => link.article_id))];
  const articles: ArticleRow[] = [];
  for (let index = 0; index < linkedArticleIds.length; index += 500) {
    const articleIds = linkedArticleIds.slice(index, index + 500);
    const { data, error } = await supabase
      .from("articles")
      .select("id, title, link, source_name, published_at")
      .in("id", articleIds)
      .lte("published_at", asOfIso)
      .gte("published_at", since30d)
      .order("published_at", { ascending: false })
      .returns<ArticleRow[]>();
    if (error) throw error;
    articles.push(...(data ?? []));
  }

  const topicById = new Map((topics ?? []).map((topic) => [topic.id, topic]));
  const articleById = new Map(articles.map((article) => [article.id, article]));
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
    if (/^(ai|科技|財經|新聞|國際)$/i.test(topic.title.trim())) continue;

    const articleCount24h = topicArticles.filter((article) => article.published_at && article.published_at >= since24h).length;
    const articleCount7d = topicArticles.filter((article) => article.published_at && article.published_at >= since7d).length;
    const articleCount30d = topicArticles.length;
    const sourceCount = new Set(topicArticles.map((article) => article.source_name)).size;
    const expected7d = Math.max(articleCount30d * (7 / 30), 1);
    const mentionSpike = Number((articleCount7d / expected7d).toFixed(2));
    const hypothesis = buildEvidenceBasedHypothesis(topic.title, sourceCount);
    const identity = resolveSignalIdentity(topic.title, asOfDate, existingSignals ?? []);
    const mappedBeneficiaries = mapBeneficiaries({
      topic: topic.title,
      hypothesis,
      signalEventId: identity.id,
    });
    if (mappedBeneficiaries.length === 0) continue;

    const highMomentum = articleCount7d >= 5 && sourceCount >= 3 && mentionSpike >= 2;
    const emergingCrossSource = articleCount7d >= 2 && sourceCount >= 2 && mentionSpike >= 1.5;
    if (!highMomentum && !emergingCrossSource) continue;

    const scoreInput = {
      mentionSpike: Math.min(mentionSpike * 20, 100),
      sourceDiversity: Math.min(sourceCount * 15, 100),
      persistence: Math.min(articleCount7d * 10, 100),
      beneficiaryClarity: 70,
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
      id: identity.id,
      signal_date: identity.signalDate,
      as_of_date: asOfDate,
      topic: topic.title,
      signal_type: "news",
      signal_strength: signalStrength,
      confidence_score: clampScore(signalStrength * 0.85),
      hypothesis,
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
          qualification: highMomentum ? "high_momentum" : "emerging_cross_source",
          beneficiary_count: mappedBeneficiaries.length,
          sample_titles: topicArticles.slice(0, 5).map((article) => article.title),
          sample_articles: topicArticles.slice(0, 5).map((article) => ({
            id: article.id,
            title: article.title,
            source_name: article.source_name,
            source_url: article.link,
            published_at: article.published_at,
          })),
          conviction: classifySignalStatus(signalStrength),
        },
      ],
      status: "active",
      model_version: "rule-v2",
      scoreComponents,
    });
  }

  const selectedRows = selectHighestConviction(rows, 3);
  if (selectedRows.length === 0) return [];

  const { data, error } = await supabase
    .from("signal_events")
    .upsert(selectedRows.map(({ scoreComponents, ...row }) => {
      void scoreComponents;
      return row;
    }), { onConflict: "id" })
    .select("id, signal_date, as_of_date, topic, signal_type, signal_strength, confidence_score, hypothesis, evidence, status, model_version")
    .returns<SignalEventRow[]>();

  if (error) throw error;

  const componentRows = selectedRows.flatMap((row) =>
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
