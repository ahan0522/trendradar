import { getSupabaseAdmin } from "@/lib/supabase-server";
import { publishableLatestPrice } from "@/lib/signals/price-quality";
import type { MarketCode } from "@/types/signals";

type ArticleRow = {
  id: string;
  title: string;
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

type WatchItem = {
  symbol: string;
  companyName: string;
  market: MarketCode;
  thesis: string;
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

function nextMonthStart(asOfDate: string) {
  const date = new Date(`${monthStart(asOfDate)}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
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

function score(articleCount: number, sourceCount: number) {
  return Math.min(95, Math.round(35 + articleCount * 7 + sourceCount * 9));
}

function confidence(articleCount: number, sourceCount: number) {
  return Math.min(90, Math.round(40 + articleCount * 5 + sourceCount * 8));
}

function priceKey(symbol: string, market: string) {
  return `${symbol}::${market}`;
}

export async function getCurrentMonthlySignals(asOfDate = currentTaipeiDate()) {
  const supabase = getSupabaseAdmin();
  const start = monthStart(asOfDate);
  const end = nextMonthStart(asOfDate);
  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, title, description, source_name, category, published_at")
    .gte("published_at", `${start}T00:00:00+00:00`)
    .lt("published_at", `${end}T00:00:00+00:00`)
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
        signalStrength: score(matchedArticles.length, sourceNames.size),
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
          .select("symbol, market, price_date, close, adj_close, volume")
          .in("symbol", symbols)
          .in("market", markets)
          .order("price_date", { ascending: false })
          .limit(5000)
          .returns<PriceRow[]>()
      : { data: [] as PriceRow[], error: null };

  if (pricesError) throw pricesError;

  const companySymbols = [...new Set(watchlistItems.map((item) => item.symbol))];
  const { data: companyActions } =
    companySymbols.length > 0
      ? await supabase
          .from("company_actions")
          .select("id, company_symbol, company_name, action_type, title, summary, known_at, source_url, quality_status")
          .in("company_symbol", companySymbols)
          .gte("known_at", `${start}T00:00:00+00:00`)
          .lte("known_at", `${asOfDate}T23:59:59+08:00`)
          .order("known_at", { ascending: false })
          .limit(100)
          .returns<CompanyActionRow[]>()
      : { data: [] as CompanyActionRow[] };

  const latestPrices = new Map<string, PriceRow>();
  for (const price of prices ?? []) {
    const key = priceKey(price.symbol, price.market);
    if (!latestPrices.has(key)) latestPrices.set(key, price);
  }

  const month = asOfDate.slice(0, 7);
  return candidates.map((candidate) => {
    const articleCount = candidate.articles.length;
    const sourceCount = candidate.sourceNames.size;
    const sampleTitles = candidate.articles.slice(0, 5).map((article) => article.title);
    const signalId = `monthly-${month}-${candidate.rule.key}`;
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

    return {
      id: signalId,
      signalDate: asOfDate,
      asOfDate,
      topic: `${month} ${candidate.rule.topic}`,
      signalType: candidate.rule.signalType,
      signalStrength: candidate.signalStrength,
      confidenceScore: candidate.confidenceScore,
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
          company_actions: relevantCompanyActions,
          missing_validation: "需要等待月底後的 30D / 60D / 90D 價格資料驗證。",
        },
      ],
      status: "active",
      modelVersion: "monthly-current-v1",
      watchlistCount: candidate.rule.watchlist.length,
      watchlists: candidate.rule.watchlist.map((item) => {
        const latestPrice = latestPrices.get(priceKey(item.symbol, item.market));
        const rawLatestPrice = latestPrice
          ? {
              priceDate: latestPrice.price_date,
              close: Number(latestPrice.close),
              adjClose: latestPrice.adj_close === null ? null : Number(latestPrice.adj_close),
              volume: latestPrice.volume === null ? null : Number(latestPrice.volume),
            }
          : null;
        const publishable = publishableLatestPrice(item.symbol, item.market, rawLatestPrice);
        return {
          symbol: item.symbol,
          companyName: item.companyName,
          market: item.market,
          thesis: item.thesis,
          weight: Number((1 / candidate.rule.watchlist.length).toFixed(4)),
          source: "monthly-rule-based",
          latestPrice: publishable.latestPrice,
          priceQuality: publishable.priceQuality,
        };
      }),
      latestOutcome: null,
      bestOutcome: null,
    };
  });
}

export async function getMonthlySignalReport(options?: {
  startMonth?: string;
  endMonth?: string;
  today?: string;
}) {
  const today = options?.today ?? currentTaipeiDate();
  const startMonth = options?.startMonth ?? "2025-01";
  const endMonth = options?.endMonth ?? today.slice(0, 7);
  const supabase = getSupabaseAdmin();
  const months = monthRange(startMonth, endMonth);

  const rows = await Promise.all(
    months.map(async (month) => {
      const asOfDate = asOfDateForMonth(month, today);
      const start = monthStart(asOfDate);
      const end = nextMonthStart(asOfDate);
      const { count, error } = await supabase
        .from("articles")
        .select("id", { count: "exact", head: true })
        .gte("published_at", `${start}T00:00:00+00:00`)
        .lt("published_at", `${end}T00:00:00+00:00`)
        .lte("published_at", `${asOfDate}T23:59:59+08:00`);

      if (error) throw error;

      const signals = count && count > 0 ? await getCurrentMonthlySignals(asOfDate) : [];
      return {
        month,
        asOfDate,
        articleCount: count ?? 0,
        signalCount: signals.length,
        status: count && count > 0 ? (signals.length > 0 ? "candidate_ready" : "no_candidate") : "no_data",
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

