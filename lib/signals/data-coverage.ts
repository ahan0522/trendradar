import { getSupabaseAdmin } from "@/lib/supabase-server";

export type CoverageMetric = {
  available: boolean;
  count: number | null;
  error?: string;
};

export type DataCoverageRow = {
  month: string;
  articles: CoverageMetric;
  stockPrices: CoverageMetric;
  marketPriceSeries: CoverageMetric;
  industryObservations: CoverageMetric;
  commodityQuotes: CoverageMetric;
  companyActions: CoverageMetric;
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
  return `${month}-01T00:00:00+00:00`;
}

function asTimestampEnd(month: string) {
  return `${nextMonth(month)}-01T00:00:00+00:00`;
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

export async function getDataCoverage(options?: { startMonth?: string; endMonth?: string }) {
  const startMonth = options?.startMonth ?? "2025-01";
  const endMonth = options?.endMonth ?? currentTaipeiMonth();
  const months = monthRange(startMonth, endMonth);

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

      return { month, articles, stockPrices, marketPriceSeries, industryObservations, commodityQuotes, companyActions };
    }),
  );

  const totals = rows.reduce(
    (acc, row) => {
      acc.articles += row.articles.count ?? 0;
      acc.stockPrices += row.stockPrices.count ?? 0;
      acc.marketPriceSeries += row.marketPriceSeries.count ?? 0;
      acc.industryObservations += row.industryObservations.count ?? 0;
      acc.commodityQuotes += row.commodityQuotes.count ?? 0;
      acc.companyActions += row.companyActions.count ?? 0;
      return acc;
    },
    {
      articles: 0,
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
