import { loadEnvConfig } from "@next/env";
import { getSupabaseAdmin } from "@/lib/supabase-server";

loadEnvConfig(process.cwd());

type LegacyTopicRow = {
  id: string;
  title: string;
  category: string | null;
};

async function main() {
  const write = process.argv.includes("--write");
  const supabase = getSupabaseAdmin();
  const baseQuery = () =>
    supabase
      .from("topics")
      .select("id, title, category")
      .like("id", "rss-topic-%")
      .is("slug", null)
      .is("last_synced_at", null)
      .eq("status", "active");

  const { data, error } = await baseQuery().returns<LegacyTopicRow[]>();
  if (error) throw error;

  let archived = 0;
  if (write && (data?.length ?? 0) > 0) {
    const { data: updated, error: updateError } = await supabase
      .from("topics")
      .update({
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .in("id", (data ?? []).map((row) => row.id))
      .select("id");
    if (updateError) throw updateError;
    archived = updated?.length ?? 0;
  }

  console.log(JSON.stringify({
    mode: write ? "write" : "dry-run",
    matched: data?.length ?? 0,
    archived,
    samples: (data ?? []).slice(0, 8),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
