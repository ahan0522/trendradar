import { getSupabaseAdmin } from "@/lib/supabase-server";
import { mapBeneficiaries } from "@/lib/signals/beneficiary-mapping";
import { publishableLatestPrice } from "@/lib/signals/price-quality";
import {
  buildSignalScoreComponents,
  calculateResearchConfidenceV2,
  calculateSignalStrength,
  type SignalStrengthInput,
} from "@/lib/signals/signal-engine";
import type { MarketCode } from "@/types/signals";
import { getMonthlyDiscoverySignals } from "@/lib/signals/monthly-discovery";
import { assessEvidenceCoverage } from "@/lib/signals/evidence-source-registry";
import {
  taipeiMonthStartIso,
  taipeiNextMonthStartIso,
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

type PriceRow = {
  symbol: string;
  market: string;
  price_date: string;
  close: number;
  adj_close: number | null;
  volume: number | null;
  quality_status: string | null;
  provider: string | null;
  source_url: string | null;
};

type CompanyActionRow = {
  id: string;
  company_symbol: string;
  company_name: string;
  action_type: string;
  title: string;
  summary: string | null;
  known_at: string;
  source_url: string;
  quality_status: string;
};

type IndustryObservationRow = {
  id: string;
  industry: string;
  metric_name: string;
  metric_value: number | null;
  metric_text: string | null;
  unit: string | null;
  known_at: string;
  source_url: string;
  quality_status: string;
};

type CommodityQuoteRow = {
  id: string;
  commodity_code: string;
  commodity_name: string;
  quote_date: string;
  price: number;
  currency: string;
  unit: string;
  known_at: string;
  source_url: string;
  quality_status: string;
};

type OutcomeRow = {
  signal_event_id: string;
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: "success" | "partial" | "failed" | "pending";
};

type LedgerSignalRow = {
  id: string;
  signal_date: string;
  as_of_date: string;
  topic: string;
  signal_type: "news" | "price" | "supply_chain" | "company_action" | "mixed";
  signal_strength: number;
  confidence_score: number;
  hypothesis: string;
  evidence: unknown[];
  status: "active" | "validated" | "partial" | "failed";
  model_version: string | null;
};

type LedgerWatchlistRow = {
  id: string;
  signal_event_id: string;
  symbol: string;
  company_name: string;
  market: MarketCode;
  thesis: string;
  value_chain_role?: string | null;
  causal_reason?: string | null;
  tracking_metrics?: string[] | null;
  invalidation_conditions?: string[] | null;
  direct_operating_link?: boolean | null;
  weight: number;
  source: string | null;
};

type WatchItem = {
  symbol: string;
  companyName: string;
  market: MarketCode;
  thesis: string;
  valueChainRole?: string;
  causalReason?: string;
  trackingMetrics?: string[];
  invalidationConditions?: string[];
  directOperatingLink?: boolean;
};

type MonthlyRule = {
  key: string;
  topic: string;
  signalType: "news" | "price" | "supply_chain" | "company_action" | "mixed";
  labels: string[];
  exclude?: string[];
  hypothesis: string;
  watchlist: WatchItem[];
};

const monthlyRules: MonthlyRule[] = [
  {
    key: "ai-compute-chip-chain",
    topic: "AI 晶片與算力供應鏈",
    signalType: "mixed",
    labels: [
      "ai晶片",
      "ai 晶片",
      "ai server",
      "ai伺服器",
      "晶片",
      "晶片股",
      "半導體",
      "gpu",
      "nvidia",
      "輝達",
      "amd",
      "超微",
      "台積電",
      "tsmc",
      "資料中心",
      "算力",
      "出口管制",
    ],
    exclude: ["無腦多", "目標價", "買超", "賣超", "投信", "三大法人", "除息", "eps"],
    hypothesis:
      "本月 AI、晶片、算力與資料中心相關新聞反覆出現，代表市場正在重新評估 AI 基礎建設需求、出口限制與供應鏈受益者。",
    watchlist: [
      { symbol: "NVDA", companyName: "NVIDIA", market: "US", thesis: "AI GPU 與資料中心算力需求的核心觀察標的。" },
      { symbol: "AMD", companyName: "Advanced Micro Devices", market: "US", thesis: "AI accelerator 競爭與替代供應鏈觀察標的。" },
      { symbol: "2330.TW", companyName: "台積電", market: "TW", thesis: "AI 晶片製造與先進製程需求的核心觀察標的。" },
      { symbol: "2317.TW", companyName: "鴻海", market: "TW", thesis: "AI server 組裝與系統整合供應鏈觀察標的。" },
      { symbol: "6669.TW", companyName: "緯穎", market: "TW", thesis: "AI server 與雲端資料中心需求的高敏感度觀察標的。" },
    ],
  },
  {
    key: "ai-power-grid",
    topic: "AI 資料中心電力與電網",
    signalType: "supply_chain",
    labels: ["缺電", "電力", "電網", "變壓器", "資料中心電力", "用電", "供電", "台電", "綠電"],
    hypothesis:
      "本月資料中心、缺電或電網相關議題升溫時，可能代表 AI 基礎建設瓶頸從算力延伸到供電、變壓器與電力系統。",
    watchlist: [
      { symbol: "GEV", companyName: "GE Vernova", market: "US", thesis: "電網與發電設備需求觀察標的。" },
      { symbol: "ETN", companyName: "Eaton", market: "US", thesis: "電力管理、UPS 與資料中心電力系統觀察標的。" },
      { symbol: "2308.TW", companyName: "台達電", market: "TW", thesis: "資料中心電源、散熱與電力管理觀察標的。" },
      { symbol: "1513.TW", companyName: "中興電", market: "TW", thesis: "台灣重電與電網投資觀察標的。" },
      { symbol: "1519.TW", companyName: "華城", market: "TW", thesis: "變壓器與電力基礎建設觀察標的。" },
    ],
  },
  {
    key: "memory-hbm",
    topic: "HBM / DRAM 記憶體供應鏈",
    signalType: "supply_chain",
    labels: ["hbm", "dram", "nand", "記憶體", "內存", "memory", "micron", "sk hynix", "三星", "samsung"],
    hypothesis:
      "本月記憶體、HBM 或 DRAM/NAND 產能相關新聞集中出現時，可能代表 AI server 需求正在改變記憶體產能配置與價格預期。",
    watchlist: [
      { symbol: "MU", companyName: "Micron", market: "US", thesis: "DRAM/NAND 與 HBM 價格循環觀察標的。" },
      { symbol: "000660.KS", companyName: "SK Hynix", market: "KR", thesis: "HBM 供應與 AI memory 需求核心觀察標的。" },
      { symbol: "005930.KS", companyName: "Samsung Electronics", market: "KR", thesis: "記憶體與先進製程供應鏈觀察標的。" },
      { symbol: "2408.TW", companyName: "南亞科", market: "TW", thesis: "台灣 DRAM 供應鏈觀察標的。" },
      { symbol: "2344.TW", companyName: "華邦電", market: "TW", thesis: "利基型記憶體與存儲需求觀察標的。" },
    ],
  },
  {
    key: "advanced-packaging",
    topic: "CoWoS / 先進封裝產能",
    signalType: "supply_chain",
    labels: ["cowos", "先進封裝", "封裝", "封測", "advanced packaging"],
    hypothesis:
      "本月先進封裝與 CoWoS 相關新聞升溫時，可能代表 AI accelerator 供應鏈瓶頸集中在封裝產能與設備供給。",
    watchlist: [
      { symbol: "2330.TW", companyName: "台積電", market: "TW", thesis: "CoWoS 與先進封裝產能核心觀察標的。" },
      { symbol: "3711.TW", companyName: "日月光投控", market: "TW", thesis: "封測產能與 advanced packaging 需求觀察標的。" },
      { symbol: "AMKR", companyName: "Amkor", market: "US", thesis: "全球封測供應鏈觀察標的。" },
      { symbol: "3131.TW", companyName: "弘塑", market: "TW", thesis: "半導體濕製程與封裝設備觀察標的。" },
      { symbol: "6187.TW", companyName: "萬潤", market: "TW", thesis: "封裝與自動化設備觀察標的。" },
    ],
  },
];

const globalNoiseKeywords = [
  "目標價",
  "買超",
  "賣超",
  "投信",
  "三大法人",
  "外資",
  "除息",
  "eps",
  "營收",
  "報酬率",
  "飆股",
  "存股",
  "女星抱",
  "想像空間",
  "噴了",
  "爆買",
  "豪擲",
  "捕貨",
  "海灌",
  "法人豪",
  "阮慕驊",
  "台股大跌",
  "台股重挫",
  "跌停",
  "股王",
  "股后",
  "千金",
  "腰斬",
  "估值修正",
  "股價大跌",
  "股價大漲",
  "暴跌",
  "重摔",
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesLabel(text: string, label: string) {
  const normalizedLabel = label.toLowerCase();
  if (/^[a-z0-9+.-]+$/.test(normalizedLabel)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedLabel)}([^a-z0-9]|$)`, "i").test(text);
  }
  return text.includes(normalizedLabel);
}

function monthStart(asOfDate: string) {
  return `${asOfDate.slice(0, 7)}-01`;
}

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function lastDayOfMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

const ledgerWatchlistBaseSelect = "id, signal_event_id, symbol, company_name, market, thesis, weight, source";
const ledgerWatchlistResearchSelect = `${ledgerWatchlistBaseSelect}, value_chain_role, causal_reason, tracking_metrics, invalidation_conditions, direct_operating_link`;

function isMissingWatchlistResearchColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
  return /value_chain_role|causal_reason|tracking_metrics|invalidation_conditions|direct_operating_link|schema cache|column/i.test(message);
}

async function readLedgerWatchlists(supabase: ReturnType<typeof getSupabaseAdmin>, signalEventIds: string[]) {
  if (signalEventIds.length === 0) return { data: [] as LedgerWatchlistRow[], error: null };

  const result = await supabase
    .from("signal_watchlists")
    .select(ledgerWatchlistResearchSelect)
    .in("signal_event_id", signalEventIds)
    .order("weight", { ascending: false })
    .returns<LedgerWatchlistRow[]>();

  if (!result.error || !isMissingWatchlistResearchColumns(result.error)) return result;

  return supabase
    .from("signal_watchlists")
    .select(ledgerWatchlistBaseSelect)
    .in("signal_event_id", signalEventIds)
    .order("weight", { ascending: false })
    .returns<LedgerWatchlistRow[]>();
}

function monthRange(startMonth: string, endMonth: string) {
  const months: string[] = [];
  const cursor = new Date(`${startMonth}-01T00:00:00.000Z`);
  const end = new Date(`${endMonth}-01T00:00:00.000Z`);

  while (cursor <= end) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

function asOfDateForMonth(month: string, today = currentTaipeiDate()) {
  const currentMonth = today.slice(0, 7);
  if (month === currentMonth) return today;
  return lastDayOfMonth(month);
}

function matchesRule(article: ArticleRow, rule: MonthlyRule) {
  const titleText = normalizeText(article.title);
  const fullText = normalizeText(`${article.title} ${article.description ?? ""} ${article.category ?? ""}`);
  if (globalNoiseKeywords.some((keyword) => matchesLabel(fullText, keyword))) return false;
  if (rule.exclude?.some((keyword) => matchesLabel(fullText, keyword))) return false;

  const titleMatch = rule.labels.some((label) => matchesLabel(titleText, label));
  if (titleMatch) return true;

  const fullTextMatches = rule.labels.filter((label) => matchesLabel(fullText, label));
  return new Set(fullTextMatches.map((label) => label.toLowerCase())).size >= 2;
}

function daysElapsedInMonth(asOfDate: string) {
  return Math.max(1, Number(asOfDate.slice(8, 10)));
}

function buildMonthlyScoreInput(
  articles: ArticleRow[],
  sourceCount: number,
  asOfDate: string,
  companyActionCount = 0,
): SignalStrengthInput {
  const asOf = new Date(`${asOfDate}T23:59:59.000Z`);
  const recentStart = new Date(asOf);
  recentStart.setUTCDate(recentStart.getUTCDate() - 7);
  const recentCount = articles.filter((article) => article.published_at && new Date(article.published_at) >= recentStart).length;
  const expectedRecent = Math.max(articles.length * (7 / daysElapsedInMonth(asOfDate)), 1);
  const mentionRatio = recentCount / expectedRecent;

  return {
    mentionSpike: Math.min(mentionRatio * 40, 100),
    priceSpike: 0,
    sourceDiversity: Math.min(sourceCount * 20, 100),
    persistence: Math.min(articles.length * 8, 100),
    companyActivity: Math.min(companyActionCount * 20, 100),
    beneficiaryClarity: 70,
  };
}

function confidence(articleCount: number, sourceCount: number, companyActionCount = 0, hasPriceEvidence = false) {
  const score = Math.round(
    25 +
    Math.min(articleCount * 1.5, 18) +
    Math.min(sourceCount * 6, 30) +
    Math.min(companyActionCount * 8, 16) +
    (hasPriceEvidence ? 12 : 0),
  );
  if (companyActionCount === 0 && !hasPriceEvidence) return Math.min(score, 68);
  return Math.min(score, 90);
}

function priceKey(symbol: string, market: string) {
  return `${symbol}::${market}`;
}

function relevantResearchData(
  ruleKey: string,
  industryRows: IndustryObservationRow[],
  commodityRows: CommodityQuoteRow[],
) {
  const industry = industryRows.filter((item) => {
    const text = `${item.industry} ${item.metric_name}`.toLowerCase();
    if (ruleKey === "ai-power-grid") return /energy|power|grid|電力|能源/.test(text);
    return /semiconductor|compute|high.?tech|半導體|算力|高科技/.test(text);
  });
  const commodities = commodityRows.filter((item) => {
    if (ruleKey !== "ai-power-grid") return false;
    return ["DHHNGSP", "WPU10250238"].includes(item.commodity_code);
  });
  return { industry: industry.slice(0, 5), commodities: commodities.slice(0, 10) };
}

function requiredEvidenceCoverageScore(
  rule: MonthlyRule,
  researchData: ReturnType<typeof relevantResearchData>,
  companyActions: CompanyActionRow[],
) {
  const coverage = assessEvidenceCoverage({
    topic: rule.topic,
    hypothesis: rule.hypothesis,
    evidenceItems: [
      ...researchData.industry.map((item) => ({
        sourceType: "industry",
        title: `${item.industry} ${item.metric_name}`,
        summary: item.metric_text ?? undefined,
        sourceName: item.source_url,
      })),
      ...researchData.commodities.map((item) => ({
        sourceType: "commodity",
        title: `${item.commodity_name} ${item.commodity_code}`,
        summary: `${item.price} ${item.currency}/${item.unit}`,
        sourceName: item.source_url,
      })),
      ...companyActions.map((item) => ({
        sourceType: "company_action",
        title: item.title,
        summary: item.summary ?? undefined,
        sourceName: item.source_url,
      })),
    ],
  });
  if (coverage.totalRequiredCount === 0) return undefined;
  return Number(((coverage.satisfiedRequiredCount / coverage.totalRequiredCount) * 100).toFixed(2));
}

export async function getCurrentMonthlySignals(asOfDate = currentTaipeiDate()) {
  const supabase = getSupabaseAdmin();
  const start = monthStart(asOfDate);
  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, title, link, description, source_name, category, published_at")
    .gte("published_at", taipeiMonthStartIso(start))
    .lt("published_at", taipeiNextMonthStartIso(start))
    .lte("published_at", `${asOfDate}T23:59:59+08:00`)
    .order("published_at", { ascending: false })
    .limit(5000)
    .returns<ArticleRow[]>();

  if (error) throw error;

  const candidates = monthlyRules
    .map((rule) => {
      const matchedArticles = (articles ?? []).filter((article) => matchesRule(article, rule));
      const sourceNames = new Set(matchedArticles.map((article) => article.source_name));
      return {
        rule,
        articles: matchedArticles,
        sourceNames,
        signalStrength: calculateSignalStrength(buildMonthlyScoreInput(matchedArticles, sourceNames.size, asOfDate)),
        confidenceScore: confidence(matchedArticles.length, sourceNames.size),
      };
    })
    .filter((candidate) => candidate.articles.length >= 2 && candidate.sourceNames.size >= 1)
    .sort((a, b) => b.signalStrength - a.signalStrength || b.sourceNames.size - a.sourceNames.size)
    .slice(0, 3);

  const watchlistItems = candidates.flatMap((candidate) => candidate.rule.watchlist);
  const symbols = [...new Set(watchlistItems.map((item) => item.symbol))];
  const markets = [...new Set(watchlistItems.map((item) => item.market))];
  const { data: prices, error: pricesError } =
    symbols.length > 0
      ? await supabase
          .from("stock_prices")
          .select("symbol, market, price_date, close, adj_close, volume, quality_status, provider, source_url")
          .in("symbol", symbols)
          .in("market", markets)
          .eq("quality_status", "verified")
          .lte("price_date", asOfDate)
          .order("price_date", { ascending: false })
          .limit(5000)
          .returns<PriceRow[]>()
      : { data: [] as PriceRow[], error: null };

  if (pricesError && pricesError.code !== "42703") throw pricesError;

  const companySymbols = [...new Set(watchlistItems.map((item) => item.symbol))];
  const { data: companyActions } =
    companySymbols.length > 0
      ? await supabase
          .from("company_actions")
          .select("id, company_symbol, company_name, action_type, title, summary, known_at, source_url, quality_status")
          .in("company_symbol", companySymbols)
          .gte("known_at", taipeiMonthStartIso(start))
          .lte("known_at", `${asOfDate}T23:59:59+08:00`)
          .eq("quality_status", "verified")
          .order("known_at", { ascending: false })
          .limit(100)
          .returns<CompanyActionRow[]>()
      : { data: [] as CompanyActionRow[] };
  const [{ data: industryObservations }, { data: commodityQuotes }] = await Promise.all([
    supabase
      .from("industry_observations")
      .select("id, industry, metric_name, metric_value, metric_text, unit, known_at, source_url, quality_status")
      .lte("known_at", `${asOfDate}T23:59:59+08:00`)
      .eq("quality_status", "verified")
      .order("known_at", { ascending: false })
      .limit(100)
      .returns<IndustryObservationRow[]>(),
    supabase
      .from("commodity_quotes")
      .select("id, commodity_code, commodity_name, quote_date, price, currency, unit, known_at, source_url, quality_status")
      .lte("known_at", `${asOfDate}T23:59:59+08:00`)
      .eq("quality_status", "verified")
      .order("known_at", { ascending: false })
      .limit(200)
      .returns<CommodityQuoteRow[]>(),
  ]);

  const latestPrices = new Map<string, PriceRow>();
  for (const price of prices ?? []) {
    const key = priceKey(price.symbol, price.market);
    if (!latestPrices.has(key)) latestPrices.set(key, price);
  }

  const month = asOfDate.slice(0, 7);
  const signalIds = candidates.map((candidate) => `monthly-${month}-${candidate.rule.key}`);
  const { data: outcomeRows, error: outcomeError } =
    signalIds.length > 0
      ? await supabase
          .from("signal_outcomes")
          .select("signal_event_id, horizon_days, basket_return, benchmark_return, excess_return, outcome")
          .in("signal_event_id", signalIds)
          .order("horizon_days", { ascending: true })
          .returns<OutcomeRow[]>()
      : { data: [] as OutcomeRow[], error: null };
  if (outcomeError) throw outcomeError;

  const outcomesBySignal = new Map<string, OutcomeRow[]>();
  for (const outcome of outcomeRows ?? []) {
    const rows = outcomesBySignal.get(outcome.signal_event_id) ?? [];
    rows.push({
      ...outcome,
      horizon_days: Number(outcome.horizon_days),
      basket_return: Number(outcome.basket_return),
      benchmark_return: Number(outcome.benchmark_return),
      excess_return: Number(outcome.excess_return),
    });
    outcomesBySignal.set(outcome.signal_event_id, rows);
  }

  return candidates.map((candidate) => {
    const articleCount = candidate.articles.length;
    const sourceCount = candidate.sourceNames.size;
    const sampleTitles = candidate.articles.slice(0, 5).map((article) => article.title);
    const sampleArticles = candidate.articles.slice(0, 5).map((article) => ({
      id: article.id,
      title: article.title,
      source_name: article.source_name,
      source_url: article.link,
      published_at: article.published_at,
    }));
    const signalId = `monthly-${month}-${candidate.rule.key}`;
    const mappedBeneficiaries = mapBeneficiaries({
      topic: candidate.rule.topic,
      hypothesis: candidate.rule.hypothesis,
      signalEventId: signalId,
    });
    const mappedBeneficiaryBySymbol = new Map(
      mappedBeneficiaries.map((item) => [item.symbol, item]),
    );
    const signalOutcomes = outcomesBySignal.get(signalId) ?? [];
    const completedOutcomes = signalOutcomes.filter((item) => item.outcome !== "pending");
    const latestOutcome = completedOutcomes.at(-1) ?? null;
    const bestOutcome = completedOutcomes.reduce<OutcomeRow | null>(
      (best, item) => !best || item.excess_return > best.excess_return ? item : best,
      null,
    );
    const candidateSymbols = new Set(candidate.rule.watchlist.map((item) => item.symbol));
    const relevantCompanyActions = (companyActions ?? [])
      .filter((item) => candidateSymbols.has(item.company_symbol))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        company_symbol: item.company_symbol,
        company_name: item.company_name,
        action_type: item.action_type,
        title: item.title,
        summary: item.summary,
        known_at: item.known_at,
        source_url: item.source_url,
        quality_status: item.quality_status,
      }));
    const researchData = relevantResearchData(
      candidate.rule.key,
      industryObservations ?? [],
      commodityQuotes ?? [],
    );
    const scoreInput = buildMonthlyScoreInput(
      candidate.articles,
      sourceCount,
      asOfDate,
      relevantCompanyActions.length,
    );
    const signalStrength = calculateSignalStrength(scoreInput);
    const confidenceInputV2 = {
      sourceQuality: Math.min(45 + sourceCount * 7, 85),
      sourceDiversity: Math.min(sourceCount * 14, 100),
      industryEvidence: Math.min(researchData.industry.length * 25, 100),
      commodityEvidence: Math.min(researchData.commodities.length * 15, 100),
      companyEvidence: Math.min(relevantCompanyActions.length * 25, 100),
      supplyChainEvidence: Math.min(
        (researchData.industry.length + relevantCompanyActions.length) * 15,
        100,
      ),
      beneficiaryClarity: candidate.rule.watchlist.length > 0 ? 80 : 0,
      marketEvidence: 0,
      persistence: Math.min(articleCount * 8, 100),
      requiredEvidenceCoverage: requiredEvidenceCoverageScore(candidate.rule, researchData, relevantCompanyActions),
      contradictionPenalty: 0,
    };
    const confidenceScore = calculateResearchConfidenceV2(confidenceInputV2);
    const scoreComponents = buildSignalScoreComponents(scoreInput, {
      article_count: articleCount,
      source_count: sourceCount,
      company_action_count: relevantCompanyActions.length,
      as_of_date: asOfDate,
    });

    return {
      id: signalId,
      signalDate: asOfDate,
      asOfDate,
      topic: `${month} ${candidate.rule.topic}`,
      signalType: candidate.rule.signalType,
      signalStrength,
      confidenceScore,
      hypothesis: `${candidate.rule.hypothesis} 目前僅使用 ${month} 月截至 ${asOfDate} 已發布資料，尚未使用任何未來資訊。`,
      evidence: [
        {
          source: "monthly-articles",
          month,
          month_start: start,
          as_of_date: asOfDate,
          article_count: articleCount,
          source_count: sourceCount,
          sample_titles: sampleTitles,
          sample_articles: sampleArticles,
          company_actions: relevantCompanyActions,
          industry_observations: researchData.industry,
          commodity_quotes: researchData.commodities,
          score_input: scoreInput,
          score_components: scoreComponents,
          confidence_input: confidenceInputV2,
          confidence_model: "research-confidence-v2",
          missing_validation: "需要等待月底後的 30D / 60D / 90D 價格資料驗證。",
        },
      ],
      status: "active",
      modelVersion: "monthly-current-v1",
      watchlistCount: candidate.rule.watchlist.length,
      watchlists: candidate.rule.watchlist.map((item) => {
        const mapped = mappedBeneficiaryBySymbol.get(item.symbol);
        const latestPrice = latestPrices.get(priceKey(item.symbol, item.market));
        const rawLatestPrice = latestPrice
          ? {
              priceDate: latestPrice.price_date,
              close: Number(latestPrice.close),
              adjClose: latestPrice.adj_close === null ? null : Number(latestPrice.adj_close),
              volume: latestPrice.volume === null ? null : Number(latestPrice.volume),
              qualityStatus: latestPrice.quality_status,
              provider: latestPrice.provider,
              sourceUrl: latestPrice.source_url,
            }
          : null;
        const publishable = publishableLatestPrice(item.symbol, item.market, rawLatestPrice, { asOfDate });
        return {
          symbol: item.symbol,
          companyName: item.companyName,
          market: item.market,
          thesis: item.thesis,
          valueChainRole: mapped?.valueChainRole,
          causalReason: mapped?.causalReason,
          trackingMetrics: mapped?.trackingMetrics ?? [],
          invalidationConditions: mapped?.invalidationConditions ?? [],
          directOperatingLink: mapped?.directOperatingLink ?? false,
          weight: Number((1 / candidate.rule.watchlist.length).toFixed(4)),
          source: "monthly-rule-based",
          latestPrice: publishable.latestPrice,
          priceQuality: publishable.priceQuality,
        };
      }),
      outcomes: signalOutcomes,
      latestOutcome,
      bestOutcome,
    };
  });
}

export async function getMonthlySignalReport(options?: {
  startMonth?: string;
  endMonth?: string;
  today?: string;
  includeCandidates?: boolean;
}) {
  const today = options?.today ?? currentTaipeiDate();
  const startMonth = options?.startMonth ?? "2025-01";
  const endMonth = options?.endMonth ?? today.slice(0, 7);
  const supabase = getSupabaseAdmin();
  const months = monthRange(startMonth, endMonth);
  if (options?.includeCandidates && months.length > 1) {
    throw new Error("Candidate discovery can only run for one month at a time.");
  }
  const reportEndDate = asOfDateForMonth(endMonth, today);
  const { data: ledgerRows, error: ledgerError } = await supabase
    .from("signal_events")
    .select("id, signal_date, as_of_date, topic, signal_type, signal_strength, confidence_score, hypothesis, evidence, status, model_version")
    .like("id", "monthly-%")
    .gte("signal_date", `${startMonth}-01`)
    .lte("signal_date", reportEndDate)
    .order("signal_date", { ascending: true })
    .returns<LedgerSignalRow[]>();
  if (ledgerError) throw ledgerError;

  const ledgerIds = (ledgerRows ?? []).map((item) => item.id);
  const [{ data: ledgerWatchlists, error: ledgerWatchlistError }, { data: ledgerOutcomes, error: ledgerOutcomeError }] =
    ledgerIds.length > 0
      ? await Promise.all([
          readLedgerWatchlists(supabase, ledgerIds),
          supabase
            .from("signal_outcomes")
            .select("signal_event_id, horizon_days, basket_return, benchmark_return, excess_return, outcome")
            .in("signal_event_id", ledgerIds)
            .order("horizon_days", { ascending: true })
            .returns<OutcomeRow[]>(),
        ])
      : [
          { data: [] as LedgerWatchlistRow[], error: null },
          { data: [] as OutcomeRow[], error: null },
        ];
  if (ledgerWatchlistError) throw ledgerWatchlistError;
  if (ledgerOutcomeError) throw ledgerOutcomeError;

  const watchlistsBySignal = new Map<string, LedgerWatchlistRow[]>();
  for (const item of ledgerWatchlists ?? []) {
    const rows = watchlistsBySignal.get(item.signal_event_id) ?? [];
    rows.push(item);
    watchlistsBySignal.set(item.signal_event_id, rows);
  }
  const ledgerOutcomesBySignal = new Map<string, OutcomeRow[]>();
  for (const item of ledgerOutcomes ?? []) {
    const rows = ledgerOutcomesBySignal.get(item.signal_event_id) ?? [];
    rows.push({
      ...item,
      horizon_days: Number(item.horizon_days),
      basket_return: Number(item.basket_return),
      benchmark_return: Number(item.benchmark_return),
      excess_return: Number(item.excess_return),
    });
    ledgerOutcomesBySignal.set(item.signal_event_id, rows);
  }

  const ledgerByMonth = new Map<string, ReturnType<typeof mapLedgerSignal>[]>();
  function mapLedgerSignal(item: LedgerSignalRow) {
    const outcomes = ledgerOutcomesBySignal.get(item.id) ?? [];
    const completed = outcomes.filter((outcome) => outcome.outcome !== "pending");
    const latestOutcome = completed.at(-1) ?? null;
    const bestOutcome = completed.reduce<OutcomeRow | null>(
      (best, outcome) => !best || outcome.excess_return > best.excess_return ? outcome : best,
      null,
    );
    const watchlists = (watchlistsBySignal.get(item.id) ?? []).map((watchlist) => ({
      symbol: watchlist.symbol,
      companyName: watchlist.company_name,
      market: watchlist.market,
      thesis: watchlist.thesis,
      valueChainRole: watchlist.value_chain_role ?? undefined,
      causalReason: watchlist.causal_reason ?? undefined,
      trackingMetrics: watchlist.tracking_metrics ?? [],
      invalidationConditions: watchlist.invalidation_conditions ?? [],
      directOperatingLink: watchlist.direct_operating_link ?? false,
      weight: Number(watchlist.weight),
      source: watchlist.source ?? "monthly-rule-based",
      latestPrice: null,
      priceQuality: { status: "needs_review" as const, reason: "歷史封存頁不顯示目前價格" },
    }));
    return {
      id: item.id,
      signalDate: item.signal_date,
      asOfDate: item.as_of_date,
      topic: item.topic,
      signalType: item.signal_type,
      signalStrength: Number(item.signal_strength),
      confidenceScore: Number(item.confidence_score),
      hypothesis: item.hypothesis,
      evidence: item.evidence,
      status: item.status,
      modelVersion: item.model_version ?? "monthly-signal-v2",
      watchlistCount: watchlists.length,
      watchlists,
      outcomes,
      latestOutcome,
      bestOutcome,
    };
  }
  for (const item of ledgerRows ?? []) {
    const month = item.signal_date.slice(0, 7);
    const rows = ledgerByMonth.get(month) ?? [];
    rows.push(mapLedgerSignal(item));
    ledgerByMonth.set(month, rows);
  }

  const rows = await Promise.all(
    months.map(async (month) => {
      const asOfDate = asOfDateForMonth(month, today);
      const start = monthStart(asOfDate);
      const { count, error } = await supabase
        .from("articles")
        .select("id", { count: "exact", head: true })
        .gte("published_at", taipeiMonthStartIso(start))
        .lt("published_at", taipeiNextMonthStartIso(start))
        .lte("published_at", `${asOfDate}T23:59:59+08:00`);

      if (error) throw error;

      const finalizedSignals = ledgerByMonth.get(month) ?? [];
      const signals = finalizedSignals.length > 0
        ? finalizedSignals
        : options?.includeCandidates && count && count > 0
          ? await getMonthlyDiscoverySignals(asOfDate)
          : [];
      return {
        month,
        asOfDate,
        articleCount: count ?? 0,
        signalCount: signals.length,
        status: signals.length > 0
          ? "candidate_ready"
          : !count
            ? "no_data"
            : count < 10
              ? "insufficient_data"
              : "no_candidate",
        signals,
      };
    }),
  );

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    startMonth,
    endMonth,
    rows,
  };
}

