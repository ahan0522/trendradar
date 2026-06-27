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


function getTitleSignals(title: string) {
  return title
    .split(/[、，,／/｜|：:；;（）()\s與和及]+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .filter((item) => !/^(討論|戰況|事故|議題|焦點|新聞|整理|周邊|安全|論述)$/u.test(item));
}

function isSummaryAligned(title: string, summary: string) {
  if (!summary) return false;
  const signals = getTitleSignals(title);
  if (signals.length === 0) return true;
  return signals.some((signal) => summary.toLowerCase().includes(signal.toLowerCase()));
}
function classifySignalType(topic: TopicRow) {
  const text = `${topic.title} ${topic.category ?? ""}`.toLowerCase();
  if (/(人工智慧|輝達|nvidia|晶片|半導體|資料中心|伺服器|電力|散熱|液冷|供應鏈|記憶體|dram|nand|hbm|cowos|封裝|機器人)/.test(text)) return "supply_chain";
  if (/股價|價格|漲價|降價|報價|price/.test(text)) return "price";
  return "news";
}

function strength(topic: TopicRow) {
  const heat = Math.min(Number(topic.heat_score ?? 0), 1000) / 10;
  const source = Math.min(Number(topic.source_count ?? 0) * 8, 40);
  const articles = Math.min(Number(topic.article_count ?? 0) * 3, 30);
  return Math.max(0, Math.min(100, Math.round(heat * 0.45 + source * 0.35 + articles * 0.2)));
}


function isMarketRelevant(topic: TopicRow) {
  const text = `${topic.title} ${topic.category ?? ""} ${topic.summary ?? ""}`.toLowerCase();

  if (/體育|世足|nba|mlb|棒球|足球|大谷|林書豪|內馬爾|gmail|電子郵件|帳號教學|教你如何/.test(text)) {
    return false;
  }

  return /ai|人工智慧|輝達|nvidia|晶片|半導體|台積電|資料中心|伺服器|電力|電網|散熱|液冷|供應鏈|記憶體|dram|nand|hbm|cowos|封裝|機器人|能源|關稅|貿易|財經|股市|產業|企業/.test(text);
}
function toSignal(topic: TopicRow): DerivedSignal {
  const signalStrength = strength(topic);
  const date = toDate(topic.last_article_published_at ?? topic.last_synced_at ?? topic.updated_at);
  const rawSummary = cleanSummary(topic.summary);
  const summary = isSummaryAligned(topic.title, rawSummary) ? rawSummary : "";

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
      `「${topic.title}」近期由 ${topic.source_count ?? 0} 個來源、${topic.article_count ?? 0} 篇代表文章共同形成討論，已達到初步市場訊號候選門檻，但仍需補充公司行動、價格與供應鏈證據。`,
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
    .gt("heat_score", 0)
    .gte("source_count", 2)
    .gte("article_count", 1)
    .order("heat_score", { ascending: false })
    .limit(limit)
    .returns<TopicRow[]>();

  if (error) throw error;
  return (data ?? []).filter(isMarketRelevant).map(toSignal);
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

export function derivedEvidenceItems(signal: DerivedSignal) {
  const metric = (signal.evidence[0] ?? {}) as {
    source?: string;
    category?: string | null;
    heat_score?: number | null;
    source_count?: number | null;
    article_count?: number | null;
  };

  return [
    {
      id: `${signal.id}-evidence-topic`,
      signalEventId: signal.id,
      evidenceDate: signal.asOfDate,
      sourceName: metric.source ?? "topics",
      sourceUrl: undefined,
      sourceType: "news",
      title: `${signal.topic} 的主題層證據`,
      summary: `目前由 ${metric.source_count ?? 0} 個來源與 ${metric.article_count ?? 0} 篇代表文章形成，主題熱度為 ${metric.heat_score ?? signal.signalStrength}。`,
      whyItMatters: "這些資料足以形成初步候選，但尚不足以證明投資假設成立；仍需補充原始來源、公司行動、受惠標的與價格驗證。",
      knownAtSignalTime: true,
    },
  ];
}

export function derivedTimelineEvents(signal: DerivedSignal) {
  return [
    {
      id: `${signal.id}-timeline-signal`,
      signalEventId: signal.id,
      eventDate: signal.signalDate,
      eventType: "signal",
      title: "偵測到訊號候選",
      description: `TrendRadar 將「${signal.topic}」辨識為具市場關聯性的主題，並轉換為初步研究候選。`,
      sourceUrl: undefined,
      knownAtSignalTime: true,
      displayOrder: 10,
    },
    {
      id: `${signal.id}-timeline-evidence`,
      signalEventId: signal.id,
      eventDate: signal.asOfDate,
      eventType: "evidence",
      title: "整理主題層證據",
      description: "目前僅使用主題層資料；完整研究案例仍需加入逐筆來源、官方公告或企業資訊。",
      sourceUrl: undefined,
      knownAtSignalTime: true,
      displayOrder: 20,
    },
    {
      id: `${signal.id}-timeline-watchlist`,
      signalEventId: signal.id,
      eventDate: undefined,
      eventType: "watchlist",
      title: "等待建立觀察籃子",
      description: "這個衍生訊號尚未完成正式受惠標的映射。",
      sourceUrl: undefined,
      knownAtSignalTime: false,
      displayOrder: 30,
    },
    {
      id: `${signal.id}-timeline-validation`,
      signalEventId: signal.id,
      eventDate: undefined,
      eventType: "validation",
      title: "等待後續驗證",
      description: "觀察籃子與 benchmark 股價完整後，才能執行 7／14／30／60 天回測。",
      sourceUrl: undefined,
      knownAtSignalTime: false,
      displayOrder: 40,
    },
  ];
}

export function derivedLessons(signal: DerivedSignal) {
  return [
    {
      id: `${signal.id}-lesson-pending`,
      signalEventId: signal.id,
      lessonType: "observation",
      title: "研究案例尚未完成",
      description: "這個衍生訊號可用於早期發現，但還不是經過完整驗證的研究案例。",
      impact: "下一步需補齊正式證據、受惠標的映射、價格資料、回測與最終結果。",
    },
  ];
}

