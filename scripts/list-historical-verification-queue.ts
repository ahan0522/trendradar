import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  rankHistoricalVerificationCandidates,
  type HistoricalVerificationCandidate,
} from "@/lib/historical-news/verification-queue";

loadEnvConfig(process.cwd());

type ArticleRow = {
  id: string;
  title: string;
  source_name: string;
  category: string | null;
  published_at: string | null;
  created_at: string | null;
  link: string | null;
};

type VerificationRow = {
  article_id: string;
  verification_status: string;
};

async function main() {
  const limitArg = process.argv.find((value) => value.startsWith("--limit="));
  const monthArg = process.argv.find((value) => value.startsWith("--month="));
  const limit = Math.min(Math.max(Number(limitArg?.split("=")[1] ?? 25), 1), 500);
  const month = monthArg?.split("=")[1] ?? null;
  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("--month must use YYYY-MM.");
  }

  const supabase = getSupabaseAdmin();
  const rows: ArticleRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    let query = supabase
      .from("articles")
      .select("id, title, source_name, category, published_at, created_at, link")
      .like("id", "historical-backfill-%")
      .order("published_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (month) {
      query = query
        .gte("published_at", `${month}-01T00:00:00Z`)
        .lt("published_at", `${nextMonth(month)}-01T00:00:00Z`);
    }
    const { data, error } = await query.returns<ArticleRow[]>();
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }

  const verifiedIds = new Set<string>();
  const ids = rows.map((row) => row.id);
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const { data, error } = await supabase
      .from("article_time_verifications")
      .select("article_id, verification_status")
      .in("article_id", batch)
      .eq("verification_status", "verified")
      .returns<VerificationRow[]>();
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") break;
      throw error;
    }
    for (const row of data ?? []) verifiedIds.add(row.article_id);
  }

  const candidates: HistoricalVerificationCandidate[] = rows
    .filter((row) => !verifiedIds.has(row.id))
    .map((row) => ({
      id: row.id,
      title: row.title,
      sourceName: row.source_name,
      category: row.category,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      link: row.link,
    }));
  const queue = rankHistoricalVerificationCandidates(candidates, limit);

  console.log(JSON.stringify({
    month,
    scanned: rows.length,
    alreadyVerified: verifiedIds.size,
    queued: queue.length,
    queue,
  }, null, 2));
}

function nextMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value, 1));
  return date.toISOString().slice(0, 7);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
