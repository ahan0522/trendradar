import { getSupabaseAdmin } from "@/lib/supabase-server";

type TableQuality = {
  available: boolean;
  total: number | null;
  verified: number | null;
  needsReview: number | null;
  latestAt: string | null;
  error?: string;
};

async function inspectTable(table: string, dateColumn: string): Promise<TableQuality> {
  const supabase = getSupabaseAdmin();
  try {
    const [totalResult, verifiedResult, reviewResult, latestResult] = await Promise.all([
      supabase.from(table).select("*", { count: "exact", head: true }),
      supabase.from(table).select("*", { count: "exact", head: true }).eq("quality_status", "verified"),
      supabase.from(table).select("*", { count: "exact", head: true }).in("quality_status", ["needs_review", "rejected"]),
      supabase.from(table).select(dateColumn).order(dateColumn, { ascending: false }).limit(1),
    ]);
    const error = totalResult.error ?? verifiedResult.error ?? reviewResult.error ?? latestResult.error;
    if (error) throw error;

    const latestRow = latestResult.data?.[0] as Record<string, string> | undefined;
    return {
      available: true,
      total: totalResult.count ?? 0,
      verified: verifiedResult.count ?? 0,
      needsReview: reviewResult.count ?? 0,
      latestAt: latestRow?.[dateColumn] ?? null,
    };
  } catch (error) {
    return {
      available: false,
      total: null,
      verified: null,
      needsReview: null,
      latestAt: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getResearchDataQualityReport() {
  const [stockPrices, companyActions, industryObservations, commodityQuotes] = await Promise.all([
    inspectTable("stock_prices", "price_date"),
    inspectTable("company_actions", "known_at"),
    inspectTable("industry_observations", "known_at"),
    inspectTable("commodity_quotes", "quote_date"),
  ]);
  const tables = { stockPrices, companyActions, industryObservations, commodityQuotes };
  const migrationRequired = Object.entries(tables)
    .filter(([, value]) => !value.available)
    .map(([name]) => name);

  const issues = [
    ...Object.entries(tables)
      .filter(([, value]) => (value.needsReview ?? 0) > 0)
      .map(([name, value]) => `${name} 有 ${value.needsReview} 筆需人工檢查或已拒絕資料。`),
    ...(migrationRequired.length > 0 ? [`尚未建立或無法讀取：${migrationRequired.join("、")}`] : []),
  ];

  return {
    ok: migrationRequired.length === 0,
    generatedAt: new Date().toISOString(),
    migrationRequired,
    tables,
    issues,
  };
}
