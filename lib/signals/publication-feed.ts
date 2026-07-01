import { getSupabaseAdmin } from "@/lib/supabase-server";
import type {
  SignalPublicationFeedItem,
  SignalPublicationPeriod,
  SignalPublicationStatus,
  SignalPublishingBrief,
} from "@/types/signals";

type PublicationRow = {
  id: string;
  signal_event_id: string;
  version: number;
  status: SignalPublicationStatus;
  quality_score: number;
  publishing_brief: SignalPublishingBrief;
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

export function publicationPeriodKey(asOfDate: string, period: SignalPublicationPeriod) {
  if (period === "daily") return asOfDate;
  if (period === "weekly") return isoWeek(asOfDate);
  return asOfDate.slice(0, 7);
}

export function buildPublicationFeed(
  rows: PublicationRow[],
  options: {
    period: SignalPublicationPeriod;
    includeApproved?: boolean;
  },
) {
  const latest = new Map<string, PublicationRow>();
  for (const row of [...rows].sort((a, b) =>
    b.version - a.version || b.created_at.localeCompare(a.created_at))) {
    if (!latest.has(row.signal_event_id)) latest.set(row.signal_event_id, row);
  }

  const allowed = options.includeApproved
    ? new Set<SignalPublicationStatus>(["approved", "published"])
    : new Set<SignalPublicationStatus>(["published"]);
  const items: SignalPublicationFeedItem[] = [...latest.values()]
    .filter((row): row is PublicationRow & { status: "approved" | "published" } => allowed.has(row.status))
    .map((row) => ({
      reviewId: row.id,
      reviewVersion: row.version,
      status: row.status,
      periodKey: publicationPeriodKey(row.publishing_brief.asOfDate, options.period),
      qualityScore: Number(row.quality_score),
      publishedAt: row.created_at,
      brief: row.publishing_brief,
    }))
    .sort((a, b) =>
      b.brief.asOfDate.localeCompare(a.brief.asOfDate) ||
      b.qualityScore - a.qualityScore ||
      a.brief.headline.localeCompare(b.brief.headline));

  const periods = new Map<string, SignalPublicationFeedItem[]>();
  for (const item of items) {
    periods.set(item.periodKey, [...(periods.get(item.periodKey) ?? []), item]);
  }
  return {
    period: options.period,
    itemCount: items.length,
    periods: [...periods.entries()].map(([periodKey, periodItems]) => ({
      periodKey,
      items: periodItems,
    })),
  };
}

export async function getPublicationFeed(options: {
  period: SignalPublicationPeriod;
  includeApproved?: boolean;
}) {
  const { data, error } = await getSupabaseAdmin()
    .from("signal_publication_reviews")
    .select("id, signal_event_id, version, status, quality_score, publishing_brief, created_at")
    .order("created_at", { ascending: false })
    .returns<PublicationRow[]>();
  if (error) throw error;
  return buildPublicationFeed(data ?? [], options);
}
