"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Clock3,
  Database,
  ExternalLink,
  Filter,
  Flame,
  Newspaper,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { categories } from "@/data/mock-topics";
import { useTrendSettings } from "@/components/useTrendSettings";
import { scoreBadgeClass } from "@/lib/trend-score";
import { TrendBar } from "@/components/TrendBar";
import type { TrendTopic } from "@/types/trend";

type ApiResponse = {
  generatedAt: string;
  mode: "rss-cluster" | "mock-fallback" | "error" | "supabase-db" | "db-not-configured";
  count: number;
  error?: string;
  lastSyncedAt?: string | null;
  stats?: {
    topicCount?: number;
    articleCount?: number;
  };
  topics: TrendTopic[];
};

type LiveTopicsDashboardProps = {
  source?: "db" | "rss";
  title?: string;
  badge?: string;
  description?: string;
};

function formatTime(value?: string | null) {
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

export function LiveTopicsDashboard({
  source = "db",
  title = "即時熱門話題",
  badge = "資料庫熱門話題",
  description = "首頁與熱門話題頁預設直接讀 Supabase，顯示已同步入庫的熱門話題、熱度分數與最後同步時間。",
}: LiveTopicsDashboardProps) {
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("全部");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<TrendTopic | null>(null);
  const { settings } = useTrendSettings();

  const visibleCategories = useMemo(() => {
    return categories.filter((category) => category === "全部" || settings.enabledCategories.includes(category as TrendTopic["category"]));
  }, [settings.enabledCategories]);

  async function loadTopics(options?: { refresh?: boolean }) {
    const params = new URLSearchParams();
    params.set("source", source);
    params.set("category", activeCategory);
    if (query.trim()) params.set("q", query.trim());
    params.set("limit", String(settings.limit));
    params.set("fallback", settings.useMockFallback ? "1" : "0");
    if (settings.region !== "全部") params.set("region", settings.region);
    if (options?.refresh) params.set("refresh", "1");

    setLoading((current) => current || !data);
    setRefreshing(Boolean(options?.refresh));

    const response = await fetch(`/api/topics?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as ApiResponse;
    setData(payload);
    setSelectedTopic((current) => {
      const filtered = filterTopicsBySettings(payload.topics, settings);
      if (current && filtered.some((topic) => topic.id === current.id)) return current;
      return filtered[0] ?? null;
    });
    setLoading(false);
    setRefreshing(false);
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const response = await fetch(`/api/sync`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Sync failed");
      }
      await loadTopics({ refresh: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      window.alert(`立即同步失敗：${message}`);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadTopics().catch(() => {
        setLoading(false);
        setRefreshing(false);
      });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [activeCategory, query, settings.limit, settings.useMockFallback, settings.region, settings.minScore, settings.enabledCategories.join("|"), source]);

  useEffect(() => {
    if (!settings.refreshIntervalMinutes) return;
    const interval = window.setInterval(() => {
      loadTopics({ refresh: true }).catch(() => {
        setRefreshing(false);
      });
    }, settings.refreshIntervalMinutes * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [settings.refreshIntervalMinutes, activeCategory, query, settings.limit, settings.useMockFallback, settings.region, source]);

  const filteredTopics = useMemo(() => filterTopicsBySettings(data?.topics ?? [], settings), [data, settings.region, settings.minScore, settings.enabledCategories.join("|")]);

  const topCategories = useMemo(() => {
    const map = new Map<string, { category: string; count: number; avg: number }>();
    filteredTopics.forEach((topic) => {
      const current = map.get(topic.category) ?? { category: topic.category, count: 0, avg: 0 };
      current.count += 1;
      current.avg += topic.score;
      map.set(topic.category, current);
    });
    return Array.from(map.values())
      .map((item) => ({ ...item, avg: Math.round(item.avg / item.count) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 6);
  }, [filteredTopics]);

  const lastSyncedCaption = data?.lastSyncedAt ? `最後同步 ${formatTime(data.lastSyncedAt)}` : source === "db" ? "尚未同步資料庫" : "依 API 即時更新";

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
              <Database className="h-4 w-4" /> {badge}
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-slate-600">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/news" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              RSS 新聞
            </a>
            <a href="/topics" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              熱門話題頁
            </a>
            <button
              onClick={() => loadTopics({ refresh: true })}
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              重新整理
            </button>
            <button
              onClick={syncNow}
              disabled={syncing}
              className="inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "同步中" : "立即同步"}
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="顯示話題數" value={loading ? "..." : String(filteredTopics.length)} caption={`資料庫共 ${data?.stats?.topicCount ?? data?.count ?? 0} 筆`} />
          <StatCard label="最高熱度" value={String(filteredTopics[0]?.score ?? "-")} caption={filteredTopics[0]?.title ?? "尚無資料"} />
          <StatCard label="最後同步" value={data?.lastSyncedAt ? formatTime(data.lastSyncedAt) : "-"} caption={lastSyncedCaption} />
          <StatCard label="資料來源" value={source === "db" ? "Supabase" : "RSS"} caption={`文章 ${data?.stats?.articleCount ?? 0} / 上限 ${settings.limit}`} />
        </section>

        {data?.error && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            讀取資料時發生問題：{data.error}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <main className="space-y-4">
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜尋熱門話題，例如：AI、台積電、旅遊、遊戲"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none transition focus:border-slate-400"
                  />
                </div>
                <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  <Filter className="mr-2 h-4 w-4" /> 分類篩選
                </div>
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {visibleCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                      activeCategory === category ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {loading && <div className="rounded-3xl bg-white p-8 text-center text-slate-500 shadow-sm">正在載入資料庫熱門話題...</div>}
              {!loading && filteredTopics.map((topic, index) => (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopic(topic)}
                  className={`w-full rounded-3xl border p-4 text-left shadow-sm transition ${
                    selectedTopic?.id === topic.id ? "border-slate-900 bg-white" : "border-transparent bg-white hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
                      <Newspaper className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">#{index + 1}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{topic.category}</span>
                        <span className="flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                          <Clock3 className="mr-1 h-3 w-3" /> {formatTime(topic.updatedAt)}
                        </span>
                      </div>
                      <h2 className="mt-2 text-lg font-semibold">{topic.title}</h2>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{topic.summary}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${scoreBadgeClass(topic.score)}`}>熱度 {topic.score}</span>
                        <span className="text-sm text-green-700">速度 {topic.velocity}</span>
                        <span className="text-sm text-slate-500">{topic.region}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {!loading && filteredTopics.length === 0 && (
                <div className="rounded-3xl bg-white p-8 text-center text-slate-500 shadow-sm">目前沒有符合條件的資料庫話題，可先按「立即同步」或放寬設定。</div>
              )}
            </div>
          </main>

          <aside className="space-y-4">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              {selectedTopic ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-slate-500">話題詳情</div>
                      <h2 className="mt-1 text-2xl font-bold">{selectedTopic.title}</h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${scoreBadgeClass(selectedTopic.score)}`}>{selectedTopic.score}</span>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <MiniInfo label="分類" value={selectedTopic.category} />
                    <MiniInfo label="地區" value={selectedTopic.region} />
                    <MiniInfo label="情緒" value={selectedTopic.sentiment} />
                  </div>

                  <div className="mt-6">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">趨勢分數</span>
                      <span>{selectedTopic.score}/100</span>
                    </div>
                    <TrendBar value={selectedTopic.score} />
                  </div>

                  <div className="mt-6 rounded-3xl bg-slate-950 p-5 text-white">
                    <div className="mb-2 flex items-center gap-2 text-sm text-slate-300"><Sparkles className="h-4 w-4" /> 自動摘要</div>
                    <p className="leading-7 text-slate-100">{selectedTopic.summary}</p>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-semibold">判斷依據</h3>
                    <div className="mt-3 space-y-2">
                      {selectedTopic.bullets.map((bullet) => (
                        <div key={bullet} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                          <TrendingUp className="h-4 w-4 text-slate-500" /> {bullet}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-semibold">來源</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedTopic.sources.map((sourceName) => (
                        <span key={sourceName} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                          {sourceName} <ExternalLink className="h-3 w-3" />
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6">
                    <Link href={`/topics/${selectedTopic.id}`} className="inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
                      查看完整詳情
                    </Link>
                  </div>
                </>
              ) : (
                <div className="text-slate-500">尚未選擇話題。</div>
              )}
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4" /> 分類熱度</h3>
              <div className="space-y-4">
                {topCategories.map((item) => (
                  <div key={item.category}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{item.category}</span>
                      <span className="text-slate-500">{item.avg}</span>
                    </div>
                    <TrendBar value={item.avg} />
                  </div>
                ))}
                {topCategories.length === 0 && <div className="text-sm text-slate-500">尚無分類資料。</div>}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}

function filterTopicsBySettings(topics: TrendTopic[], settings: ReturnType<typeof useTrendSettings>["settings"]) {
  return topics.filter((topic) => {
    const matchCategory = settings.enabledCategories.includes(topic.category);
    const matchScore = topic.score >= settings.minScore;
    const matchRegion = settings.region === "全部" || topic.region.includes(settings.region) || topic.region.includes("全球");
    return matchCategory && matchScore && matchRegion;
  });
}

function StatCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      <div className="mt-2 text-sm text-slate-600">{caption}</div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
