import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  validateCommodityQuote,
  validateCompanyAction,
  validateIndustryObservation,
} from "@/lib/research-data/validation";
import type {
  CommodityQuote,
  CompanyAction,
  IndustryObservation,
  ResearchSource,
} from "@/types/research-data";

export async function upsertResearchSources(sources: ResearchSource[]) {
  if (sources.length === 0) return { count: 0 };
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("research_sources").upsert(
    sources.map((source) => ({
      id: source.id,
      name: source.name,
      source_type: source.sourceType,
      base_url: source.baseUrl ?? null,
      authority_level: source.authorityLevel,
      reliability_score: source.reliabilityScore,
      metadata: source.metadata ?? {},
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "id" },
  );
  if (error) throw error;
  return { count: sources.length };
}

export async function upsertIndustryObservations(items: IndustryObservation[]) {
  const rows = items.map(validateIndustryObservation).map((item) => ({
    id: item.id,
    industry: item.industry,
    metric_name: item.metricName,
    metric_value: item.metricValue ?? null,
    metric_text: item.metricText ?? null,
    unit: item.unit ?? null,
    period_start: item.periodStart ?? null,
    period_end: item.periodEnd ?? null,
    published_at: item.publishedAt,
    observed_at: item.observedAt,
    known_at: item.knownAt,
    source_id: item.sourceId ?? null,
    source_url: item.sourceUrl,
    quality_status: item.qualityStatus,
    confidence_score: item.confidenceScore,
    metadata: item.metadata ?? {},
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return { count: 0 };
  const { error } = await getSupabaseAdmin()
    .from("industry_observations")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
  return { count: rows.length };
}

export async function upsertCommodityQuotes(items: CommodityQuote[]) {
  const rows = items.map(validateCommodityQuote).map((item) => ({
    id: item.id,
    commodity_code: item.commodityCode,
    commodity_name: item.commodityName,
    quote_date: item.quoteDate,
    quote_type: item.quoteType,
    price: item.price,
    currency: item.currency,
    unit: item.unit,
    published_at: item.publishedAt,
    observed_at: item.observedAt,
    known_at: item.knownAt,
    source_id: item.sourceId ?? null,
    source_url: item.sourceUrl,
    quality_status: item.qualityStatus,
    verification_source_id: item.verificationSourceId ?? null,
    metadata: item.metadata ?? {},
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return { count: 0 };
  const { error } = await getSupabaseAdmin()
    .from("commodity_quotes")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
  return { count: rows.length };
}

export async function upsertCompanyActions(items: CompanyAction[]) {
  const rows = items.map(validateCompanyAction).map((item) => ({
    id: item.id,
    company_symbol: item.companySymbol,
    market: item.market,
    company_name: item.companyName,
    action_type: item.actionType,
    title: item.title,
    summary: item.summary ?? null,
    effective_date: item.effectiveDate ?? null,
    published_at: item.publishedAt,
    observed_at: item.observedAt,
    known_at: item.knownAt,
    source_id: item.sourceId ?? null,
    source_url: item.sourceUrl,
    quality_status: item.qualityStatus,
    metadata: item.metadata ?? {},
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return { count: 0 };
  const { error } = await getSupabaseAdmin()
    .from("company_actions")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
  return { count: rows.length };
}
