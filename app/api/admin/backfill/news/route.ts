import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  fetchGoogleNewsHistoricalMonth,
  type GoogleNewsBackfillResult,
} from "@/lib/historical-news/google-news";

type BackfillArticleInput = {
  title?: string;
  url?: string;
  link?: string;
  sourceName?: string;
  publishedAt?: string;
  description?: string;
  category?: string;
  region?: string;
  query?: string;
};

type BackfillBody = {
  startDate?: string;
  endDate?: string;
  queries?: string[];
  articles?: BackfillArticleInput[];
  provider?: "manual" | "google_news";
  dryRun?: boolean;
};

function stableId(value: string) {
  return `historical-backfill-${crypto.createHash("sha1").update(value).digest("hex")}`;
}

function isIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeQueries(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 50);
}

function normalizeArticle(input: BackfillArticleInput) {
  const title = input.title?.trim();
  const link = (input.url ?? input.link)?.trim();
  const publishedAt = input.publishedAt?.trim();

  if (!title || !link || !publishedAt) return null;

  return {
    id: stableId(link),
    title,
    link,
    source_id: "historical-google-news",
    source_name: input.sourceName?.trim() || "Historical Backfill",
    category: input.category?.trim() || "AI Infrastructure",
    region: input.region?.trim() || "GLOBAL",
    description: input.description?.trim() || "",
    published_at: publishedAt.includes("T") ? publishedAt : `${publishedAt}T00:00:00+00:00`,
    updated_at: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  let body: BackfillBody;
  try {
    body = (await request.json()) as BackfillBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const startDate = body.startDate ?? "2025-01-01";
  const endDate = body.endDate ?? new Date().toISOString().slice(0, 10);
  const queries = normalizeQueries(body.queries);
  let articles = Array.isArray(body.articles) ? body.articles : [];
  let providerResult: GoogleNewsBackfillResult | null = null;

  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return NextResponse.json({ ok: false, error: "startDate and endDate must use YYYY-MM-DD." }, { status: 400 });
  }

  if (articles.length === 0 && body.provider === "google_news") {
    try {
      providerResult = await fetchGoogleNewsHistoricalMonth({
        startDate,
        endDate,
        queries,
      });
      articles = providerResult.articles;
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Historical provider failed.",
        },
        { status: 400 },
      );
    }
  }

  if (articles.length === 0) {
    return NextResponse.json({
      ok: true,
      mode: "provider_not_configured",
      imported: 0,
      startDate,
      endDate,
      plannedQueries: queries,
      message:
        "Historical backfill pipeline is ready, but no provider result or manual articles were provided. Supply body.articles metadata or connect a historical/search news provider. These records will be marked as historical_backfill, not RSS.",
    });
  }

  const rows = articles
    .map(normalizeArticle)
    .filter((row): row is NonNullable<ReturnType<typeof normalizeArticle>> => Boolean(row))
    .filter((row) => {
      const publishedDate = row.published_at.slice(0, 10);
      return publishedDate >= startDate && publishedDate <= endDate;
    });

  if (rows.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "No valid articles. Each article needs title, url/link, and publishedAt.",
      },
      { status: 400 },
    );
  }

  if (body.dryRun) {
    return NextResponse.json({
      ok: true,
      mode: body.provider === "google_news" ? "google_news_dry_run" : "manual_dry_run",
      imported: 0,
      fetched: rows.length,
      queryCount: providerResult?.queryCount ?? queries.length,
      providerErrors: providerResult?.errors ?? [],
      startDate,
      endDate,
      samples: rows.slice(0, 10),
    });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("articles").upsert(rows, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mode: body.provider === "google_news" ? "google_news_historical" : "manual_metadata",
    imported: rows.length,
    skipped: articles.length - rows.length,
    startDate,
    endDate,
    sourceKind: "historical_backfill",
    queryCount: providerResult?.queryCount ?? queries.length,
    providerErrors: providerResult?.errors ?? [],
  });
}
