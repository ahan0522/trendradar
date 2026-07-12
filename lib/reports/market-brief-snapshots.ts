import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getMarketBrief } from "@/lib/reports/market-brief";
import type { MarketBrief, MarketBriefPeriod, MarketBriefStatus } from "@/types/market-report";

export type MarketBriefSnapshot = {
  id: string;
  reportVersion: string;
  period: MarketBriefPeriod;
  periodKey: string;
  asOfDate: string;
  revision: number;
  contentHash: string;
  qualityStatus: MarketBriefStatus;
  brief: MarketBrief;
  generatedAt: string;
  createdAt: string;
};

type SnapshotRow = {
  id: string;
  report_version: string;
  period: MarketBriefPeriod;
  period_key: string;
  as_of_date: string;
  revision: number;
  content_hash: string;
  quality_status: MarketBriefStatus;
  report_payload: MarketBrief;
  generated_at: string;
  created_at: string;
};

function isoWeek(dateText: string) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function marketBriefPeriodKey(period: MarketBriefPeriod, asOfDate: string) {
  if (period === "daily") return asOfDate;
  if (period === "weekly") return isoWeek(asOfDate);
  return asOfDate.slice(0, 7);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function marketBriefContentHash(brief: MarketBrief) {
  const payload = canonicalize({ ...brief, generatedAt: null });
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function marketBriefQualityStatus(brief: MarketBrief): MarketBriefStatus {
  if (brief.dataQuality.every((item) => item.status === "ready")) return "ready";
  if (brief.dataQuality.some((item) => item.status !== "pending")) return "partial";
  return "pending";
}

function mapSnapshot(row: SnapshotRow): MarketBriefSnapshot {
  return {
    id: row.id,
    reportVersion: row.report_version,
    period: row.period,
    periodKey: row.period_key,
    asOfDate: row.as_of_date,
    revision: Number(row.revision),
    contentHash: row.content_hash,
    qualityStatus: row.quality_status,
    brief: row.report_payload,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
  };
}

export async function getLatestMarketBriefSnapshot(options: {
  period: MarketBriefPeriod;
  asOfDate: string;
}) {
  const periodKey = marketBriefPeriodKey(options.period, options.asOfDate);
  const { data, error } = await getSupabaseAdmin()
    .from("market_brief_snapshots")
    .select("id, report_version, period, period_key, as_of_date, revision, content_hash, quality_status, report_payload, generated_at, created_at")
    .eq("report_version", "market-brief-v1")
    .eq("period", options.period)
    .eq("period_key", periodKey)
    .order("revision", { ascending: false })
    .limit(1)
    .returns<SnapshotRow[]>();
  if (error && ["42P01", "PGRST205"].includes(error.code)) return null;
  if (error) throw error;
  return data?.[0] ? mapSnapshot(data[0]) : null;
}

export async function persistMarketBriefSnapshot(brief: MarketBrief) {
  const periodKey = marketBriefPeriodKey(brief.period, brief.asOfDate);
  const contentHash = marketBriefContentHash(brief);
  const latest = await getLatestMarketBriefSnapshot({ period: brief.period, asOfDate: brief.asOfDate });
  if (latest?.contentHash === contentHash) {
    return { ok: true, action: "unchanged" as const, snapshot: latest };
  }

  const revision = (latest?.revision ?? 0) + 1;
  const qualityStatus = marketBriefQualityStatus(brief);
  const { data, error } = await getSupabaseAdmin()
    .from("market_brief_snapshots")
    .insert({
      report_version: brief.reportVersion,
      period: brief.period,
      period_key: periodKey,
      as_of_date: brief.asOfDate,
      revision,
      content_hash: contentHash,
      quality_status: qualityStatus,
      report_payload: brief,
      generated_at: brief.generatedAt,
    })
    .select("id, report_version, period, period_key, as_of_date, revision, content_hash, quality_status, report_payload, generated_at, created_at")
    .single<SnapshotRow>();
  if (error) throw error;
  return { ok: true, action: "inserted" as const, snapshot: mapSnapshot(data) };
}

export async function getStoredOrLiveMarketBrief(options: {
  period: MarketBriefPeriod;
  asOfDate?: string;
}) {
  const asOfDate = options.asOfDate ?? new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const snapshot = await getLatestMarketBriefSnapshot({ period: options.period, asOfDate });
  if (snapshot) return { brief: snapshot.brief, snapshot, source: "snapshot" as const };
  return {
    brief: await getMarketBrief({ period: options.period, asOfDate }),
    snapshot: null,
    source: "live-fallback" as const,
  };
}
