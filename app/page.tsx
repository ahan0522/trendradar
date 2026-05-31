import { LiveTopicsDashboard } from "@/components/LiveTopicsDashboard";

export default function HomePage() {
  return (
    <LiveTopicsDashboard
      source="db"
      badge="首頁・資料庫版"
      title="今日熱門話題"
      description="首頁預設直接讀取 Supabase 熱門話題資料庫，顯示最後同步時間，並可手動觸發 RSS 同步。"
    />
  );
}
