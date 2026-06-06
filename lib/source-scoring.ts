import type {
  NewsItem,
  SourceKind,
  SourcePool,
  SourceRole,
  SourceTier,
} from "@/types/news";

type SourceSignal = {
  sourceName: string;
  title?: string;
  description?: string;
  sourcePool?: SourcePool;
  sourceKind?: SourceKind;
  sourceTier?: SourceTier;
  sourceWeight?: number;
  credibilityWeight?: number;
  sourceRole?: SourceRole;
  publishedAt: string | null;
};

const DEFAULT_SOURCE_WEIGHT = 1;
const DEFAULT_CREDIBILITY_WEIGHT = 1;

const PLATFORM_SOURCE_PATTERN = /^(Google News|Yahoo新聞|Yahoo奇摩新聞|LINE TODAY|MSN)\b/i;

const SOURCE_ALIASES: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: "中央社", patterns: [/中央社/] },
  { canonical: "聯合新聞網", patterns: [/聯合新聞網|UDN/i] },
  { canonical: "自由時報", patterns: [/自由時報|自由健康網/] },
  { canonical: "自由體育", patterns: [/自由體育/] },
  { canonical: "中時新聞網", patterns: [/中時新聞網|中時/] },
  { canonical: "工商時報", patterns: [/工商時報/] },
  { canonical: "三立新聞網", patterns: [/三立新聞網|SETN/i] },
  { canonical: "ETtoday新聞雲", patterns: [/ETtoday|ettoday/i] },
  { canonical: "TVBS", patterns: [/TVBS/i] },
  { canonical: "民視新聞網", patterns: [/民視/] },
  { canonical: "東森新聞", patterns: [/東森/] },
  { canonical: "公視新聞網", patterns: [/公視|PNN/i] },
  { canonical: "鏡新聞", patterns: [/鏡新聞/] },
  { canonical: "上報", patterns: [/上報/] },
  { canonical: "風傳媒", patterns: [/風傳媒/] },
  { canonical: "鉅亨網", patterns: [/鉅亨/] },
  { canonical: "MoneyDJ", patterns: [/MoneyDJ/i] },
  { canonical: "TechNews", patterns: [/TechNews|科技新報/i] },
  { canonical: "The Verge", patterns: [/The Verge/i] },
  { canonical: "Engadget", patterns: [/Engadget/i] },
  { canonical: "TechCrunch", patterns: [/TechCrunch/i] },
  { canonical: "外交部", patterns: [/外交部/] },
  { canonical: "國防部", patterns: [/國防部/] },
  { canonical: "中央氣象署", patterns: [/中央氣象署|氣象署/] },
];

function normalizeSourceText(value: string) {
  return value.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function matchKnownSourceName(value: string) {
  const text = normalizeSourceText(value);
  const matched = SOURCE_ALIASES.find((source) =>
    source.patterns.some((pattern) => pattern.test(text))
  );

  return matched?.canonical ?? "";
}

function extractTrailingSourceName(title?: string) {
  if (!title) return "";

  const cleanedTitle = normalizeSourceText(title);
  const trailingMatch = cleanedTitle.match(/\s[-–—|｜]\s([^|｜\-–—]{2,42})$/);
  const trailingText = trailingMatch?.[1]?.trim() ?? "";

  return trailingText ? matchKnownSourceName(trailingText) : "";
}

export function isPlatformSourceName(sourceName?: string) {
  return PLATFORM_SOURCE_PATTERN.test(sourceName?.trim() ?? "");
}

export function inferOriginalSourceName(source: {
  sourceName?: string;
  title?: string;
  description?: string;
}) {
  const trailingSource = extractTrailingSourceName(source.title);
  if (trailingSource) return trailingSource;

  const embeddedSource = matchKnownSourceName(
    `${source.title ?? ""} ${source.description ?? ""}`
  );
  if (embeddedSource) return embeddedSource;

  return "";
}

export function getSourceWeight(source: {
  sourceWeight?: number;
  sourceKind?: SourceKind;
  sourcePool?: SourcePool;
  sourceTier?: SourceTier;
}) {
  if (typeof source.sourceWeight === "number") return source.sourceWeight;

  if (source.sourceTier === "social_signal") return 1.25;
  if (source.sourceTier === "primary_source") return 1.05;
  if (source.sourceKind === "official_announcement") return 1.5;
  if (source.sourceKind === "search_trend") return 1.4;
  if (source.sourceKind === "mainstream_news") return 1.15;
  if (source.sourceKind === "industry_media") return 1.05;
  if (source.sourceKind === "aggregator") return 0.8;
  if (source.sourcePool === "social_discussion") return 1.35;

  return DEFAULT_SOURCE_WEIGHT;
}

export function getCredibilityWeight(source: {
  credibilityWeight?: number;
  sourceKind?: SourceKind;
  sourceTier?: SourceTier;
}) {
  if (typeof source.credibilityWeight === "number") return source.credibilityWeight;

  if (source.sourceTier === "primary_source") return 1.6;
  if (source.sourceTier === "social_signal") return 0.65;
  if (source.sourceKind === "official_announcement") return 1.5;
  if (source.sourceKind === "mainstream_news") return 1.25;
  if (source.sourceKind === "industry_media") return 1.1;
  if (source.sourceKind === "aggregator") return 0.75;

  return DEFAULT_CREDIBILITY_WEIGHT;
}

export function getWeightedSourceScore(articles: SourceSignal[]) {
  const bestWeightBySource = new Map<string, number>();

  articles.forEach((article) => {
    const sourceName = getCanonicalSourceName(article);
    const currentWeight = bestWeightBySource.get(sourceName) ?? 0;
    const sourceWeight = getSourceWeight(article);
    const credibilityWeight = getCredibilityWeight(article);

    bestWeightBySource.set(
      sourceName,
      Math.max(currentWeight, sourceWeight * credibilityWeight)
    );
  });

  return [...bestWeightBySource.values()].reduce((sum, weight) => sum + weight, 0);
}

export function getCanonicalSourceName(source: {
  sourceName?: string;
  title?: string;
  description?: string;
  sourceKind?: SourceKind;
}) {
  const sourceName = source.sourceName?.trim() || "unknown";

  if (isPlatformSourceName(sourceName) || source.sourceKind === "aggregator") {
    const inferredSourceName = inferOriginalSourceName(source);
    if (inferredSourceName) return inferredSourceName;
    return "Google News";
  }

  const knownSourceName = matchKnownSourceName(sourceName);
  if (knownSourceName) return knownSourceName;

  if (sourceName.startsWith("中央社")) {
    return "中央社";
  }

  return sourceName;
}

export function getEffectiveSourceCount(
  articles: Pick<SourceSignal, "sourceName" | "sourceKind" | "title" | "description">[]
) {
  return new Set(
    articles
      .map(getCanonicalSourceName)
      .filter((sourceName) => !isPlatformSourceName(sourceName))
  ).size;
}

export function getRawSourceCount(articles: Pick<SourceSignal, "sourceName">[]) {
  return new Set(
    articles.map((article) => article.sourceName.trim()).filter(Boolean)
  ).size;
}

export function getRecentWeightedScore(articles: SourceSignal[], windowHours = 6) {
  const now = Date.now();

  return articles.reduce((sum, article) => {
    if (!article.publishedAt) return sum;

    const publishedAt = new Date(article.publishedAt).getTime();
    if (Number.isNaN(publishedAt)) return sum;
    if (now - publishedAt > windowHours * 60 * 60 * 1000) return sum;

    return sum + getSourceWeight(article);
  }, 0);
}

export function computeWeightedHeatScore(articles: SourceSignal[]) {
  const sourceScore = getWeightedSourceScore(articles);
  const volumeScore = articles.reduce(
    (sum, article) => sum + getSourceWeight(article),
    0
  );
  const recentScore = getRecentWeightedScore(articles);

  return Math.round(sourceScore * 30 + volumeScore * 10 + recentScore * 20);
}

export function getSourcePoolLabel(pool?: SourcePool) {
  const labels: Record<SourcePool, string> = {
    social_discussion: "社群討論",
    news_media: "新聞媒體",
    search_platform_trend: "搜尋/平台趨勢",
    forum_community: "論壇/社群平台",
    official_source: "官方來源",
  };

  return pool ? labels[pool] : "未分類來源";
}

export function getSourceTierLabel(tier?: SourceTier) {
  const labels: Record<SourceTier, string> = {
    primary_source: "核心一手資訊",
    secondary_analysis: "專業權威解讀",
    social_signal: "社群迴聲訊號",
  };

  return tier ? labels[tier] : "未分級來源";
}

export function summarizeSourcePools(items: Pick<NewsItem, "sourcePool">[]) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const label = getSourcePoolLabel(item.sourcePool);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
