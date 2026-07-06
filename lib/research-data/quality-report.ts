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
    automatedSources: ["SEC EDGAR Company Facts", "SEC EDGAR Micron Exhibits", "TWSE OpenAPI"],
    note: "已接入美光公司總體庫存、資本支出及官方 HBM 產品里程碑；仍缺可比較的位元出貨與全產業產能序列，泛用高科技指標不可替代。",
  },
  {
    key: "ai_server_shipments",
    label: "AI Server / GPU / accelerator 出貨",
    status: "licensed_or_manual_required",
    automatedSources: [],
    note: "目前缺少可合法重播的產業出貨序列；只有 filing metadata 不構成出貨證據。",
  },
  {
    key: "cloud_capex",
    label: "雲端業者資本支出",
    status: "partial",
    automatedSources: ["SEC EDGAR Company Facts"],
    note: "已接入主要雲端業者公司總體資本支出，但不得標示為 AI 專屬資本支出。",
  },
  {
    key: "power_grid_equipment",
    label: "變壓器與電網設備活動",
    status: "automated",
    automatedSources: [
      "FRED PCU335311335311",
      "FRED WPU117409",
      "FRED IPG3353S",
      "FRED IPG22112S",
    ],
    note: "使用 BLS／Federal Reserve 官方序列，涵蓋變壓器價格與電氣設備產出；known_at 採 TrendRadar 首次取得時間。",
  },
  {
    key: "power_demand",
    label: "電力發電、輸配與利用率",
    status: "automated_general_key_required",
    automatedSources: [
      "FRED IPG2211S",
      "FRED CAPUTLG2211S",
      "EIA US48 Grid Monitor",
    ],
    note: "EIA adapter 已完成，設定 EIA_API_KEY 後可每日同步全美電網實際負載；所有序列都只能驗證一般電力活動，不能冒充資料中心專屬用電需求。",
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
