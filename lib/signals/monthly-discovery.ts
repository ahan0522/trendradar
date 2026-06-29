import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  discoverCandidateTopics,
  enrichCandidateTopicsWithHistory,
  type CandidateTopic,
} from "@/lib/topic-candidates";
import {
  dedupeArticlesByEventWindow,
  dedupeArticlesByFingerprintWindow,
} from "@/lib/article-dedupe";
import { calculateHeatLifecycle } from "@/lib/discovery/heat-lifecycle";
import { getEffectiveSourceCount, getRawSourceCount } from "@/lib/source-scoring";
import { mapBeneficiaries } from "@/lib/signals/beneficiary-mapping";
import {
  buildEvidenceBasedHypothesis,
  buildSignalScoreComponents,
  calculateResearchConfidence,
  calculateSignalHeat,
} from "@/lib/signals/signal-engine";
import {
  taipeiDateForTimestamp,
  taipeiMonthStartIso,
} from "@/lib/time/taipei";

type ArticleRow = {
  id: string;
  title: string;
  link: string;
  description: string | null;
  source_name: string;
  category: string | null;
  published_at: string | null;
};

const marketNoise =
  /目標價|買超|賣超|投信|三大法人|外資|除息|殖利率|eps|每股盈餘|月營收|合併營收|飆股|存股|盤中|開盤|收盤|漲停|跌停|股價大漲|股價大跌/i;
const nonInvestableCategory = /體育|娛樂|影劇|動漫|遊戲|旅遊|美食/i;

export const marketLenses: Array<{
  key: string;
  label: string;
  category: string;
  pattern: RegExp;
  requiredContext?: RegExp;
  exclude?: RegExp;
}> = [
  {
    key: "ai-compute",
    label: "AI 算力與資料中心",
    category: "AI",
    pattern: /人工智慧|\bAI\b|算力|GPU|輝達|NVIDIA|資料中心|AI伺服器|AI 伺服器/i,
    requiredContext: /晶片|半導體|GPU|算力|資料中心|伺服器|HPC|封裝|基礎建設|供應鏈|ABF|CoPoS/i,
  },
  { key: "semiconductor", label: "半導體與先進製程", category: "科技", pattern: /半導體|晶片|台積電|TSMC|先進製程|晶圓|封裝|CoWoS/i },
  { key: "memory", label: "記憶體供需循環", category: "科技", pattern: /HBM|DRAM|NAND|記憶體|Micron|美光|海力士|Samsung|三星/i },
  { key: "power-grid", label: "電力、電網與資料中心能源", category: "財經", pattern: /電力|電網|變壓器|資料中心用電|供電|核能|綠電/i },
  { key: "energy-commodities", label: "能源與原物料", category: "財經", pattern: /原油|油價|天然氣|能源|銅價|金價|黃金(?:價格|市場|避險|期貨)|原物料|荷姆茲/i },
  { key: "macro-rates", label: "利率、通膨與總體經濟", category: "財經", pattern: /利率|通膨|央行|聯準會|\bFed\b|降息|升息|匯率|經濟成長|衰退/i, exclude: /地震|車禍|刑案/i },
  { key: "trade-tariffs", label: "關稅與全球供應鏈重組", category: "國際", pattern: /關稅|貿易戰|出口管制|制裁|供應鏈轉移|美中|對台關稅/i },
  { key: "biotech-health", label: "生技、醫療與新藥", category: "生活", pattern: /生技|醫療|新藥|藥物|疫苗|臨床試驗|FDA|疾病/i },
  { key: "defense-geopolitics", label: "國防、軍工與地緣風險", category: "國際", pattern: /國防|軍工|軍售|無人機|飛彈|戰爭|台海|中東|俄烏|以色列|伊朗/i, exclude: /世足|足球|球賽|NBA|網球|棒球|籃球/i },
  { key: "robotics", label: "機器人與自動化", category: "科技", pattern: /機器人|自動化|人形機器人|協作機器人|Robot|Robotics/i },
  { key: "ev-battery", label: "電動車與電池供應鏈", category: "科技", pattern: /電動車|\bEV\b|電池|鋰電池|儲能|特斯拉|\bTesla\b/i, exclude: /車禍|事故|打滑|衝撞|crash|lawsuit/i },
  { key: "optical-network", label: "高速網路與光通訊", category: "科技", pattern: /CPO|矽光子|光通訊|光模組|網通|高速互連|800G|1\.6T/i },
];

function monthStart(asOfDate: string) {
  return `${asOfDate.slice(0, 7)}-01`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function stableSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function sourceCredibilityScore(sourceName: string) {
  if (/政府|部會|證交所|公開資訊觀測站|公司公告|法說|Reuters|Bloomberg|路透|彭博/i.test(sourceName)) {
    return 95;
  }
  if (/中央社|CNA|經濟日報|工商時報|科技新報|TechNews|TrendForce|DIGITIMES|日經|Nikkei|金融時報|Financial Times|華爾街日報|Wall Street Journal/i.test(sourceName)) {
    return 85;
  }
  if (/聯合|UDN|自由|中時|公視|商業周刊|今周刊|財訊|MoneyDJ|鉅亨網|TechCrunch|The Verge|Engadget/i.test(sourceName)) {
    return 72;
  }
  if (/Google News|Yahoo|LINE TODAY|MSN|CMoney|鉅亨號|PChome|蕃新聞|商傳媒|投資網誌/i.test(sourceName)) {
    return 42;
  }
  return 58;
}

function candidateSourceQuality(candidate: CandidateTopic) {
  const uniqueSources = new Map<string, number>();
  for (const article of candidate.articles) {
    const sourceName = article.sourceName.trim();
    if (!sourceName) continue;
    uniqueSources.set(sourceName, sourceCredibilityScore(sourceName));
  }
  const scores = [...uniqueSources.values()];
  if (scores.length === 0) return 40;
  return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2));
}

function candidateFamily(candidate: CandidateTopic) {
  const text = `${candidate.category} ${candidate.title} ${candidate.keywords.join(" ")}`.toLowerCase();
  const families: Array<[string, RegExp]> = [
    ["memory", /hbm|dram|nand|memory|記憶體/],
    ["power-energy", /電力|電網|能源|核能|天然氣|石油|原油|太陽能|風電/],
    ["ai-compute", /ai|人工智慧|晶片|半導體|gpu|算力|資料中心/],
    ["geopolitics", /戰爭|軍事|國防|關稅|制裁|台海|中東|俄烏|美中/],
    ["health-biotech", /醫療|生技|藥物|疫苗|臨床|新藥/],
    ["mobility", /電動車|汽車|電池|自駕|機器人/],
    ["macro", /通膨|利率|央行|聯準會|匯率|經濟|衰退/],
  ];
  return families.find(([, pattern]) => pattern.test(text))?.[0] ?? (candidate.category || "other");
}

function candidatePriority(candidate: CandidateTopic) {
  const lifecycleBoost = {
    breaking_out: 28,
    rising: 24,
    sustained_high: 20,
    emerging: 10,
    cooling: 2,
  }[candidate.heatState];
  return (
    lifecycleBoost +
    candidate.qualityScore * 0.45 +
    Math.min(candidate.sourceCount, 8) * 4 +
    Math.min(candidate.articleCount, 12) * 2 +
    candidate.persistenceScore * 0.12
  );
}

function isInvestableCandidate(candidate: CandidateTopic) {
  if (!/生活|社會/i.test(candidate.category)) return true;
  const text = `${candidate.title} ${candidate.summary} ${candidate.articles.map((item) => item.title).join(" ")}`;
  return marketLenses.some(
    (lens) =>
      lens.pattern.test(text) &&
      (!lens.requiredContext || lens.requiredContext.test(text)) &&
      !lens.exclude?.test(text),
  );
}

function normalizeCandidateTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/^\d{4}-\d{2}\s*/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function isRelatedCandidate(left: CandidateTopic, right: CandidateTopic) {
  const leftIds = new Set(left.articles.map((item) => item.id));
  if (right.articles.some((item) => leftIds.has(item.id))) return true;

  const leftTitle = normalizeCandidateTitle(left.title);
  const rightTitle = normalizeCandidateTitle(right.title);
  if (leftTitle.length >= 8 && rightTitle.length >= 8) {
    if (leftTitle.includes(rightTitle) || rightTitle.includes(leftTitle)) return true;
    if (leftTitle.slice(0, 8) === rightTitle.slice(0, 8)) return true;
  }

  const leftKeywords = new Set(left.keywords.map((item) => item.toLowerCase()));
  return right.keywords.filter((item) => leftKeywords.has(item.toLowerCase())).length >= 2;
}

function selectDiverseCandidates(candidates: CandidateTopic[], limit = 5) {
  const selected: CandidateTopic[] = [];
  const familyCounts = new Map<string, number>();
  let sustainedCount = 0;

  for (const candidate of [...candidates].sort((a, b) => candidatePriority(b) - candidatePriority(a))) {
    if (selected.length >= limit) break;
    if (nonInvestableCategory.test(candidate.category)) continue;
    if (!isInvestableCandidate(candidate)) continue;
    if (marketNoise.test(`${candidate.title} ${candidate.summary}`)) continue;
    if (candidate.sourceCount < 3) continue;
    const family = candidateFamily(candidate);
    if (selected.some(
      (item) => candidateFamily(item) === family && isRelatedCandidate(item, candidate),
    )) continue;
    if (!candidate.publishable && !(candidate.qualityScore >= 68 && candidate.sourceCount >= 2 && candidate.articleCount >= 3)) {
      continue;
    }

    if ((familyCounts.get(family) ?? 0) >= 2) continue;
    if (candidate.heatState === "sustained_high" && sustainedCount >= 2) continue;

    selected.push(candidate);
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
    if (candidate.heatState === "sustained_high") sustainedCount += 1;
  }

  return selected;
}

function buildLensCandidates(
  currentArticles: ReturnType<typeof toDiscoveryArticle>[],
  historicalArticles: ReturnType<typeof toDiscoveryArticle>[],
  asOfDate: string,
): CandidateTopic[] {
  return marketLenses.flatMap((lens) => {
    const currentMatches = currentArticles.filter((article) =>
      lens.pattern.test(article.title) &&
      (!lens.requiredContext || lens.requiredContext.test(article.title)) &&
      !lens.exclude?.test(article.title),
    );
    const representative = dedupeArticlesByEventWindow(currentMatches);
    const sourceCount = getEffectiveSourceCount(currentMatches);
    if (representative.length < 3 || sourceCount < 3) return [];

    const historyMatches = historicalArticles.filter((article) =>
      lens.pattern.test(article.title) &&
      (!lens.requiredContext || lens.requiredContext.test(article.title)) &&
      !lens.exclude?.test(article.title),
    );
    const representativeHistory = dedupeArticlesByFingerprintWindow(historyMatches);
    const lifecycle = calculateHeatLifecycle({
      publishedAt: representativeHistory.map((article) => article.publishedAt),
      sourceCount: getEffectiveSourceCount(historyMatches),
      asOfDate,
    });
    const qualityScore = Math.min(
      96,
      Math.round(35 + sourceCount * 5 + Math.min(representative.length, 12) * 2 + lifecycle.activeDays),
    );
    const heatScore = Math.round(
      representative.length * 8 +
      sourceCount * 15 +
      lifecycle.persistenceScore * 0.5 +
      Math.min(lifecycle.velocityRatio, 4) * 10,
    );

    return [{
      id: `lens-${lens.key}`,
      slug: lens.key,
      title: lens.label,
      summary: `${lens.label}在本月由 ${sourceCount} 個有效來源、${representative.length} 個去重事件共同形成研究候選。`,
      category: lens.category,
      keywords: lens.label.split(/[、與\s]+/).filter((value) => value.length >= 2),
      articleCount: representative.length,
      rawArticleCount: currentMatches.length,
      sourceCount,
      rawSourceCount: getRawSourceCount(currentMatches),
      heatScore,
      heatState: lifecycle.state,
      heatStateLabel: lifecycle.label,
      heatReason: lifecycle.reason,
      articleCount24h: lifecycle.articleCount24h,
      articleCount7d: lifecycle.articleCount7d,
      articleCount30d: lifecycle.articleCount30d,
      activeDays: lifecycle.activeDays,
      persistenceScore: lifecycle.persistenceScore,
      velocityRatio: lifecycle.velocityRatio,
      firstSeenAt: lifecycle.firstSeenAt,
      qualityScore,
      publishable: qualityScore >= 68,
      rejectionReasons: [],
      latestPublishedAt: representative[0]?.publishedAt ?? asOfDate,
      articles: representative.slice(0, 8).map((article) => ({
        id: article.id,
        title: article.title,
        sourceName: article.sourceName,
        category: article.category ?? "",
        link: article.link ?? "",
        publishedAt: article.publishedAt,
      })),
    } satisfies CandidateTopic];
  });
}

function toDiscoveryArticle(row: ArticleRow) {
  return {
    id: row.id,
    title: row.title,
    description: "",
    sourceName: row.source_name,
    category: row.category ?? "新聞",
    link: row.link,
    publishedAt: row.published_at,
  };
}

export async function getMonthlyDiscoverySignals(asOfDate: string, options?: { limit?: number }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) throw new Error("asOfDate must use YYYY-MM-DD");

  const supabase = getSupabaseAdmin();
  const currentStart = monthStart(asOfDate);
  const historyStart = addDays(currentStart, -30);
  const rows: ArticleRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("articles")
      .select("id, title, link, description, source_name, category, published_at")
      .gte("published_at", taipeiMonthStartIso(historyStart))
      .lte("published_at", `${asOfDate}T23:59:59+08:00`)
      .order("published_at", { ascending: false })
      .range(offset, offset + pageSize - 1)
      .returns<ArticleRow[]>();
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }

  const historicalArticles = rows
    .filter((article) => !marketNoise.test(`${article.title} ${article.description ?? ""}`))
    .map(toDiscoveryArticle);
  const currentArticles = historicalArticles.filter(
    (article) =>
      article.publishedAt &&
      taipeiDateForTimestamp(article.publishedAt) >= currentStart &&
      taipeiDateForTimestamp(article.publishedAt) <= asOfDate,
  );
  const categoryBuckets = new Map<string, typeof currentArticles>();
  for (const article of currentArticles) {
    const category = article.category || "新聞";
    const rows = categoryBuckets.get(category) ?? [];
    rows.push(article);
    categoryBuckets.set(category, rows);
  }
  const baseCandidates = [...categoryBuckets.values()].flatMap((bucket) =>
    bucket.length >= 2
      ? discoverCandidateTopics(bucket, {
          maxTopics: 8,
          minArticles: 2,
          similarityThreshold: 0.18,
          asOfDate,
        })
      : [],
  );
  const enrichedCandidates = baseCandidates.map((candidate) => {
    const sameCategoryHistory = historicalArticles.filter(
      (article) => (article.category || "新聞") === candidate.category,
    );
    return enrichCandidateTopicsWithHistory(
      [candidate],
      sameCategoryHistory.length > 0 ? sameCategoryHistory : historicalArticles,
      asOfDate,
    )[0];
  });
  const lensCandidates = buildLensCandidates(currentArticles, historicalArticles, asOfDate);
  const selected = selectDiverseCandidates(
    [...enrichedCandidates, ...lensCandidates],
    options?.limit ?? 5,
  );
  const month = asOfDate.slice(0, 7);

  return selected.map((candidate) => {
    const signalId = `monthly-discovery-${month}-${stableSlug(candidate.slug || candidate.title)}`;
    const hypothesis = buildEvidenceBasedHypothesis(candidate.title, candidate.sourceCount);
    const watchlists = mapBeneficiaries({
      topic: `${candidate.title} ${candidate.keywords.join(" ")}`,
      hypothesis,
      signalEventId: signalId,
    });
    const heatInput = {
      mentionSpike: Math.min(Math.max(candidate.velocityRatio, 1) * 24, 100),
      velocity: Math.min(Math.max(candidate.velocityRatio, 0) * 30, 100),
      articleVolume: Math.min(candidate.articleCount * 8, 100),
      sourceDiversity: Math.min(candidate.sourceCount * 16, 100),
      persistence: candidate.persistenceScore,
    };
    const confidenceInput = {
      sourceQuality: candidateSourceQuality(candidate),
      sourceDiversity: Math.min(candidate.sourceCount * 10, 100),
      evidenceDepth: Math.min(candidate.articleCount * 5, 100),
      persistence: candidate.persistenceScore,
      companyActivity: 0,
      beneficiaryClarity: watchlists.length > 0 ? 60 : 10,
      priceConfirmation: 0,
    };
    const signalStrength = calculateSignalHeat(heatInput);
    const confidenceScore = Math.min(
      watchlists.length > 0 ? 75 : 60,
      calculateResearchConfidence(confidenceInput),
    );
    const scoreComponents = buildSignalScoreComponents({
      mentionSpike: heatInput.mentionSpike,
      sourceDiversity: heatInput.sourceDiversity,
      persistence: heatInput.persistence,
      beneficiaryClarity: confidenceInput.beneficiaryClarity,
    }, {
      discovery_mode: "monthly-full-market-v2",
      heat_state: candidate.heatState,
      quality_score: candidate.qualityScore,
      article_count: candidate.articleCount,
      source_count: candidate.sourceCount,
      velocity_ratio: candidate.velocityRatio,
      persistence_score: candidate.persistenceScore,
    });

    return {
      id: signalId,
      signalDate: asOfDate,
      asOfDate,
      topic: `${month} ${candidate.title}`,
      signalType: "news" as const,
      signalStrength,
      confidenceScore,
      hypothesis,
      evidence: [{
        source: "monthly-full-market-discovery",
        discovery_mode: "monthly-full-market-v2",
        month,
        as_of_date: asOfDate,
        category: candidate.category,
        keywords: candidate.keywords,
        article_count: candidate.articleCount,
        event_count: candidate.articleCount,
        raw_article_count: candidate.rawArticleCount ?? candidate.articleCount,
        duplicate_rate:
          (candidate.rawArticleCount ?? candidate.articleCount) > 0
            ? Number(
                (
                  (((candidate.rawArticleCount ?? candidate.articleCount) -
                    candidate.articleCount) /
                    (candidate.rawArticleCount ?? candidate.articleCount)) *
                  100
                ).toFixed(1),
              )
            : 0,
        source_count: candidate.sourceCount,
        raw_source_count: candidate.rawSourceCount,
        heat_score: candidate.heatScore,
        heat_state: candidate.heatState,
        heat_state_label: candidate.heatStateLabel,
        heat_reason: candidate.heatReason,
        article_count_7d: candidate.articleCount7d,
        article_count_30d: candidate.articleCount30d,
        active_days: candidate.activeDays,
        velocity_ratio: candidate.velocityRatio,
        persistence_score: candidate.persistenceScore,
        quality_score: candidate.qualityScore,
        watchlist_status: watchlists.length > 0 ? "mapped" : "industry_research_only",
        sample_titles: candidate.articles.slice(0, 5).map((article) => article.title),
        sample_articles: candidate.articles.slice(0, 5).map((article) => ({
          id: article.id,
          title: article.title,
          source_name: article.sourceName,
          source_url: article.link,
          published_at: article.publishedAt,
        })),
        heat_input: heatInput,
        confidence_input: confidenceInput,
        heat_model: "signal-heat-v1",
        confidence_model: "research-confidence-v1",
        score_components: scoreComponents,
      }],
      status: "active" as const,
      modelVersion: "monthly-full-market-v2",
      watchlistCount: watchlists.length,
      watchlists: watchlists.map((item) => ({
        symbol: item.symbol,
        companyName: item.companyName,
        market: item.market,
        thesis: item.thesis,
        weight: item.weight,
        source: item.source ?? "rule-based",
        latestPrice: null,
        priceQuality: { status: "needs_review" as const, reason: "候選封存後再補價格驗證" },
      })),
      outcomes: [],
      latestOutcome: null,
      bestOutcome: null,
    };
  });
}
