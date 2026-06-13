"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, Database, RefreshCw, Search, Sparkles } from "lucide-react";

type TopicCard = {
  id: string;
  slug: string;
  title: string;
  category: string;
  heroImageUrl: string;
  heatScore: number;
  sourceCount: number;
  articleCount: number;
  updatedAt: string;
  discoveryMode: string;
};

type TopicHomeResponse = {
  ok?: boolean;
  generatedAt?: string;
  count?: number;
  targetCount?: number;
  activeTopicCount?: number;
  newestUpdatedAt?: string;
  qualityStatus?: {
    level: "healthy" | "limited" | "empty";
    label: string;
    description: string;
  };
  categorySummary?: Array<{ category: string; count: number }>;
  topics?: TopicCard[];
  error?: string;
};

function formatTime(value?: string) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";

  return date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value?: string) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";

  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 1000 / 60);
  if (diffMinutes < 1) return "剛剛";
  if (diffMinutes < 60) return `${diffMinutes} 分鐘前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小時前`;

  return `${Math.floor(diffHours / 24)} 天前`;
}

function getModeLabel(mode: string) {
  if (mode === "candidate_cluster") return "自動候選分群";
  if (mode === "rule_based") return "規則分群";
  if (mode === "ai_discovered") return "AI 自動發現";
  return mode || "自動整理";
}

export default function TopicsPage() {
  const [data, setData] = useState<TopicHomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [error, setError] = useState("");

  async function loadTopics() {
    setRefreshing(true);
    setError("");

    try {
      const response = await fetch("/api/topics/db-home?limit=12", {
        cache: "no-store",
      });
      const payload = (await response.json()) as TopicHomeResponse;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? "熱門主題載入失敗");
      }

      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "熱門主題載入失敗");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTopics();
  }, []);

  const topics = useMemo(() => data?.topics ?? [], [data?.topics]);
  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(topics.map((topic) => topic.category)))],
    [topics]
  );
  const filteredTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return topics.filter((topic) => {
      const matchCategory = category === "全部" || topic.category === category;
      const matchQuery =
        !normalizedQuery ||
        `${topic.title} ${topic.category}`.toLowerCase().includes(normalizedQuery);

      return matchCategory && matchQuery;
    });
  }, [category, query, topics]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
              <Database className="h-4 w-4" />
              熱門話題頁・主線資料庫版
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              今日熱門大主題
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              這裡直接讀取 /api/topics/db-home，顯示目前可上首頁的大主題，不再使用舊 mock 或舊 id 詳情頁。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/news"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              查看新聞來源
            </Link>
            <button
              onClick={loadTopics}
              disabled={refreshing}
              className="inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              重新整理
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <StatusCard label="目前顯示" value={loading ? "..." : `${topics.length} 個`} caption={`目標 ${data?.targetCount ?? 6} 個`} />
          <StatusCard label="可用主題" value={String(data?.activeTopicCount ?? topics.length)} caption="已通過品質門檻" />
          <StatusCard label="整理狀態" value={data?.qualityStatus?.label ?? "讀取中"} caption={data?.qualityStatus?.description ?? "正在讀取主題狀態"} />
          <StatusCard label="最新同步" value={formatTime(data?.newestUpdatedAt)} caption={data?.newestUpdatedAt ? `${formatRelativeTime(data.newestUpdatedAt)}更新` : "等待資料"} />
        </section>

        {error && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            讀取熱門主題時發生問題：{error}
          </section>
        )}

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋主題，例如：中東、AI、體育、疫情"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none transition focus:border-slate-400"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              只顯示目前有資料的分類
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                  category === item
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-80 animate-pulse rounded-3xl bg-white shadow-sm"
              />
            ))}
          </div>
        ) : filteredTopics.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <Sparkles className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-4 text-xl font-semibold text-slate-800">
              目前沒有符合條件的大主題
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              這通常是分類或搜尋條件太窄，不代表資料庫是空的。可以切回「全部」或按重新整理。
            </p>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTopics.map((topic) => (
              <Link
                key={topic.id}
                href={`/topics/${topic.slug}`}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
              >
                <img
                  src={topic.heroImageUrl}
                  alt={topic.title}
                  className="h-44 w-full object-cover transition duration-300 group-hover:scale-105"
                />

                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {topic.category}
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {getModeLabel(topic.discoveryMode)}
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-950">
                    {topic.title}
                  </h2>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <MiniMetric label="熱度" value={String(topic.heatScore)} />
                    <MiniMetric label="媒體" value={`${topic.sourceCount} 家`} />
                    <MiniMetric label="文章" value={`${topic.articleCount} 篇`} />
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-4 w-4" />
                      {formatRelativeTime(topic.updatedAt)}
                    </span>
                    <span className="font-semibold text-slate-800 transition group-hover:translate-x-1">
                      查看主題 →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function StatusCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 line-clamp-2 text-2xl font-bold leading-tight text-slate-950">
        {value}
      </div>
      <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
        {caption}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-bold text-slate-950">{value}</div>
    </div>
  );
}
