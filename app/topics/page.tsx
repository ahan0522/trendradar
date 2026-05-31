import { LiveTopicsDashboard } from "@/components/LiveTopicsDashboard";

export default function TopicsPage() {
  return (
    <LiveTopicsDashboard
      source="db"
      badge="熱門話題頁・資料庫版"
      title="熱門話題排行榜"
      description="依照已同步進 Supabase 的新聞資料進行分群與排序，適合日常瀏覽與後續做自動排程同步。"
    />
  );
}
