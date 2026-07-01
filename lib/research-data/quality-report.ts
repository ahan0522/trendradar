import { getSupabaseAdmin } from "@/lib/supabase-server";

type TableQuality = {
  available: boolean;
  total: number | null;
  verified: number | null;
  needsReview: number | null;
  latestAt: string | null;
  error?: string;
};

export const researchCoveragePlan = [
  {
    key: "memory_pricing",
    label: "DRAM / NAND / HBM 報價",
    status: "licensed_or_manual_required",
    automatedSources: [],
    note: "目前沒有可合法自動化且具歷史 publication timestamp 的免費報價源；不得用新聞標題或股價替代。",
  },
  {
    key: "memory_supply",
    label: "記憶體產能、庫存與位元出貨",
    status: "partial",
    automatedSources: ["SEC EDGAR", "TWSE OpenAPI"],
    note: "公司公告已接入，但仍需解析財報與法說內容；泛用高科技產能指標不算記憶體專屬證據。",
  },
  {
    key: "ai_server_shipments",
    label: "AI Server / GPU / accelerator 出貨",
    status: "licensed_or_manual_required",
    automatedSources: [],
    note: "目前缺少可合法重播的產業出貨序列；只有 filing metadata 不構成出貨證據。",
  },
  {
    key: "power_grid_equipment",
    label: "變壓器與電網設備活動",
    status: "automated",
    automatedSources: ["FRED PCU335311335311", "FRED IPG22112S"],
    note: "使用 BLS／Federal Reserve 官方序列，known_at 採 TrendRadar 首次取得時間。",
  },
  {
    key: "power_demand",
    label: "電力發電、輸配與利用率",
    status: "automated_general",
    automatedSources: ["FRED IPG2211S", "FRED CAPUTLG2211S"],
    note: "可驗證一般電力活動，但不能冒充資料中心專屬用電需求。",
  },
] as const;

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

async function inspectLedgerTable(table: string, dateColumn: string): Promise<TableQuality> {
  const supabase = getSupabaseAdmin();
  try {
    const [totalResult, latestResult] = await Promise.all([
      supabase.from(table).select("*", { count: "exact", head: true }),
      supabase.from(table).select(dateColumn).order(dateColumn, { ascending: false }).limit(1),
    ]);
    const error = totalResult.error ?? latestResult.error;
    if (error) throw error;
    const latestRow = latestResult.data?.[0] as Record<string, string> | undefined;
    return {
      available: true,
      total: totalResult.count ?? 0,
      verified: null,
      needsReview: null,
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
  const [
    stockPrices,
    companyActions,
    industryObservations,
    commodityQuotes,
    signalEvidence,
    scoreComponents,
    signalTimeline,
    signalLessons,
  ] = await Promise.all([
    inspectTable("stock_prices", "price_date"),
    inspectTable("company_actions", "known_at"),
    inspectTable("industry_observations", "known_at"),
    inspectTable("commodity_quotes", "quote_date"),
    inspectLedgerTable("signal_evidence_items", "created_at"),
    inspectLedgerTable("signal_score_components", "calculated_at"),
    inspectLedgerTable("signal_timeline_events", "created_at"),
    inspectLedgerTable("signal_lessons", "created_at"),
  ]);
  const tables = {
    stockPrices,
    companyActions,
    industryObservations,
    commodityQuotes,
    signalEvidence,
    scoreComponents,
    signalTimeline,
    signalLessons,
  };
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
    coveragePlan: researchCoveragePlan,
  };
}
