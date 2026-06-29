import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getArticleEventFingerprint } from "@/lib/article-dedupe";
import { getCanonicalSourceName, isPlatformSourceName } from "@/lib/source-scoring";
import {
  taipeiDateForTimestamp,
  taipeiMonthForTimestamp,
  taipeiMonthStartIso,
  taipeiNextMonthStartIso,
} from "@/lib/time/taipei";

export type CoverageMetric = {
  available: boolean;
  count: number | null;
  error?: string;
};

export type DataCoverageRow = {
  month: string;
  articles: CoverageMetric;
  researchEvents: CoverageMetric;
  duplicateRate: number | null;
  effectiveSources: CoverageMetric;
  stockPrices: CoverageMetric;
  marketPriceSeries: CoverageMetric;
  industryObservations: CoverageMetric;
  commodityQuotes: CoverageMetric;
  companyActions: CoverageMetric;
  researchStatus: MonthResearchStatus;
};

export type MonthResearchStatusCode =
  | "backfill_required"
  | "discovery_limited"
  | "discovery_ready"
  | "validation_ready"
  | "multi_evidence_ready";

export type MonthResearchStatus = {
  code: MonthResearchStatusCode;
  label: string;
  reason: string;
};

type ArticleSourceRow = {
  source_name: string;
  title: string;
  description: string | null;
  link: string | null;
  published_at: string;
};

function currentTaipeiMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
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

function nextMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 7);
}

function asTimestampStart(month: string) {
  return taipeiMonthStartIso(month);
}

function asTimestampEnd(month: string) {
  return taipeiNextMonthStartIso(month);
}

function asDateStart(month: string) {
  return `${month}-01`;
}

function asDateEnd(month: string) {
  return `${nextMonth(month)}-01`;
}

function unavailable(error: unknown): CoverageMetric {
  const message = error instanceof Error ? error.message : String(error);
  return { available: false, count: null, error: message };
}

async function countRows(table: string, dateColumn: string, start: string, end: string): Promise<CoverageMetric> {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .gte(dateColumn, start)
      .lt(dateColumn, end);

    if (error) return unavailable(error.message);
    return { available: true, count: count ?? 0 };
  } catch (error) {
    return unavailable(error);
  }
}

async function getArticleCoverageByMonth(startMonth: string, endMonth: string) {
  const supabase = getSupabaseAdmin();
  const sourceSets = new Map<string, Set<string>>();
  const eventFingerprintsByMonth = new Map<string, Set<string>>();
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("articles")
      .select("source_name, title, description, link, published_at")
      .gte("published_at", asTimestampStart(startMonth))
      .lt("published_at", asTimestampEnd(endMonth))
      .order("published_at", { ascending: true })
      .range(offset, offset + pageSize - 1)
      .returns<ArticleSourceRow[]>();
    if (error) throw error;

    for (const article of data ?? []) {
      const month = taipeiMonthForTimestamp(article.published_at);
      const date = taipeiDateForTimestamp(article.published_at);
      const fingerprint = getArticleEventFingerprint({
        title: article.title,
        description: article.description,
        sourceName: article.source_name,
        link: article.link,
        publishedAt: article.published_at,
      });
      const fingerprints = eventFingerprintsByMonth.get(month) ?? new Set<string>();
      fingerprints.add(`${date}:${fingerprint || article.link || article.title}`);
      eventFingerprintsByMonth.set(month, fingerprints);

      const canonical = getCanonicalSourceName({
        sourceName: article.source_name,
        title: article.title,
        description: article.description ?? undefined,
      });
      if (!canonical || isPlatformSourceName(canonical)) continue;
      const sources = sourceSets.get(month) ?? new Set<string>();
      sources.add(canonical);
      sourceSets.set(month, sources);
    }

    if ((data ?? []).length < pageSize) break;
  }

  const researchEventCounts = new Map(
    [...eventFingerprintsByMonth].map(([month, fingerprints]) => [month, fingerprints.size]),
  );

  return { sourceSets, researchEventCounts };
}

export function classifyMonthCoverage(input: {
  articleCount: number;
  researchEventCount?: number;
  effectiveSourceCount: number;
  stockPriceCount: number;
  marketPriceSeriesCount: number;
  industryObservationCount: number;
  commodityQuoteCount: number;
  companyActionCount: number;
}): MonthResearchStatus {
  if (input.articleCount === 0) {
    return {
      code: "backfill_required",
      label: "尚未回補",
      reason: "本月資料庫沒有文章，不能判定為沒有市場訊號。",
    };
  }
  const researchEventCount = input.researchEventCount ?? input.articleCount;
  if (researchEventCount < 10 || input.effectiveSourceCount < 3) {
    return {
      code: "discovery_limited",
      label: "資料偏薄",
      reason: `目前只有 ${researchEventCount} 個研究事件、${input.effectiveSourceCount} 個有效來源，僅供觀察。`,
    };
  }

  const hasPrices = input.stockPriceCount > 0 || input.marketPriceSeriesCount > 0;
  const evidenceTypes = [
    input.industryObservationCount,
    input.commodityQuoteCount,
    input.companyActionCount,
  ].filter((count) => count > 0).length;

  if (!hasPrices) {
    return {
      code: "discovery_ready",
      label: "可做主題發現",
      reason: "新聞與有效來源足以執行Discovery，但尚無價格資料可驗證結果。",
    };
  }
  if (evidenceTypes === 0) {
    return {
      code: "validation_ready",
      label: "可做價格驗證",
      reason: "新聞與價格資料已就緒，產業、商品或公司證據仍待補強。",
    };
  }
  return {
    code: "multi_evidence_ready",
    label: "多類證據已就緒",
    reason: `新聞、價格及 ${evidenceTypes} 類非新聞證據可用。`,
  };
}

export async function getDataCoverage(options?: { startMonth?: string; endMonth?: string }) {
  const startMonth = options?.startMonth ?? "2025-01";
  const endMonth = options?.endMonth ?? currentTaipeiMonth();
  const months = monthRange(startMonth, endMonth);
  const articleCoverage = await getArticleCoverageByMonth(startMonth, endMonth);

  const rows: DataCoverageRow[] = await Promise.all(
    months.map(async (month) => {
      const [articles, stockPrices, marketPriceSeries, industryObservations, commodityQuotes, companyActions] = await Promise.all([
        countRows("articles", "published_at", asTimestampStart(month), asTimestampEnd(month)),
        countRows("stock_prices", "price_date", asDateStart(month), asDateEnd(month)),
        countRows("market_price_series", "price_date", asDateStart(month), asDateEnd(month)),
        countRows("industry_observations", "known_at", asTimestampStart(month), asTimestampEnd(month)),
        countRows("commodity_quotes", "quote_date", asDateStart(month), asDateEnd(month)),
        countRows("company_actions", "known_at", asTimestampStart(month), asTimestampEnd(month)),
      ]);

      const effectiveSources = {
        available: true,
        count: articleCoverage.sourceSets.get(month)?.size ?? 0,
      };
      const researchEvents = {
        available: true,
        count: articleCoverage.researchEventCounts.get(month) ?? 0,
      };
      const duplicateRate =
        (articles.count ?? 0) > 0
          ? Number(
              (((articles.count ?? 0) - researchEvents.count) / (articles.count ?? 1) * 100).toFixed(1),
            )
          : null;
      const researchStatus = classifyMonthCoverage({
        articleCount: articles.count ?? 0,
        researchEventCount: researchEvents.count,
        effectiveSourceCount: effectiveSources.count,
        stockPriceCount: stockPrices.count ?? 0,
        marketPriceSeriesCount: marketPriceSeries.count ?? 0,
        industryObservationCount: industryObservations.count ?? 0,
        commodityQuoteCount: commodityQuotes.count ?? 0,
        companyActionCount: companyActions.count ?? 0,
      });

      return {
        month,
        articles,
        researchEvents,
        duplicateRate,
        effectiveSources,
        stockPrices,
        marketPriceSeries,
        industryObservations,
        commodityQuotes,
        companyActions,
        researchStatus,
      };
    }),
  );

  const totals = rows.reduce(
    (acc, row) => {
      acc.articles += row.articles.count ?? 0;
      acc.researchEvents += row.researchEvents.count ?? 0;
      acc.effectiveSources += row.effectiveSources.count ?? 0;
      acc.stockPrices += row.stockPrices.count ?? 0;
      acc.marketPriceSeries += row.marketPriceSeries.count ?? 0;
      acc.industryObservations += row.industryObservations.count ?? 0;
      acc.commodityQuotes += row.commodityQuotes.count ?? 0;
      acc.companyActions += row.companyActions.count ?? 0;
      return acc;
    },
    {
      articles: 0,
      researchEvents: 0,
      effectiveSources: 0,
      stockPrices: 0,
      marketPriceSeries: 0,
      industryObservations: 0,
      commodityQuotes: 0,
      companyActions: 0,
    },
  );

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    startMonth,
    endMonth,
    rows,
    totals,
  };
}
