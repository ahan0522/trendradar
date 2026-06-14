"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HomepageTopicCard = {
  id: string;
  slug: string;
  title: string;
  category: string;
  heroImageUrl: string;
  heatScore: number;
  quickSummary?: string;
  sourceQuality?: {
    label: string;
    tone: "strong" | "medium" | "weak";
  };
  sourceCount: number;
  articleCount: number;
  updatedAt: string;
};

type HomeQualityStatus = {
  level: "healthy" | "limited" | "empty";
  label: string;
  description: string;
};

type HomeTopicResponse = {
  topics?: HomepageTopicCard[];
  targetCount?: number;
  activeTopicCount?: number;
  newestUpdatedAt?: string;
  qualityStatus?: HomeQualityStatus;
  categorySummary?: Array<{
    category: string;
    count: number;
  }>;
};

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 1000 / 60);

  if (diffMinutes < 1) return "剛剛";
  if (diffMinutes < 60) return `${diffMinutes} 分鐘前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小時前`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

function getSourceQualityClass(
  tone?: NonNullable<HomepageTopicCard["sourceQuality"]>["tone"]
) {
  if (tone === "strong") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-500";
}

export default function HomePage() {
  const [topics, setTopics] = useState<HomepageTopicCard[]>([]);
  const [metadata, setMetadata] = useState<HomeTopicResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/topics/db-home")
      .then((res) => res.json())
      .then((data: HomeTopicResponse) => {
        setTopics(data.topics ?? []);
        setMetadata(data);
      })
      .catch((err) => console.error("Failed to load topics:", err))
      .finally(() => setLoading(false));
  }, []);

  const qualityStatus = metadata?.qualityStatus;
  const targetCount = metadata?.targetCount ?? 6;
  const categorySummary = metadata?.categorySummary ?? [];
  const featuredTopic = topics[0];
  const secondaryTopics = topics.slice(1);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm md:px-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-blue-600">
              TrendRadar
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
              今天大家在討論什麼
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 md:text-base">
              把重複新聞合併成大主題，先看快讀摘要，再決定要不要深入。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/trend-map"
              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700"
            >
              主題分子圖
            </Link>
            <Link
              href="/trend-globe"
              className="rounded-full bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
            >
              議題地球村
            </Link>
            {!loading && (
              <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                顯示 {topics.length} 個主題，目標 {targetCount} 個
              </div>
            )}
          </div>
        </div>

        {!loading && (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                    {qualityStatus?.label ?? "整理狀態"}
                  </span>
                  {metadata?.newestUpdatedAt && (
                    <span className="text-xs font-medium text-slate-500">
                      最新整理 {formatRelativeTime(metadata.newestUpdatedAt)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {qualityStatus?.description ??
                    "系統正在整理今天的熱門新聞焦點。"}
                </p>
              </div>

              {categorySummary.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {categorySummary.map((item) => (
                    <span
                      key={item.category}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
                    >
                      {item.category} {item.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
        </div>

        {loading ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
              />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <div className="text-xl font-semibold text-slate-700">
              目前還沒有可顯示的大主題
            </div>
            <p className="mt-2 text-sm text-slate-500">
              系統正在整理最新新聞，請稍後再重新整理。
            </p>
          </div>
        ) : (
          <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
            {featuredTopic && (
              <Link
                href={`/topics/${featuredTopic.slug}`}
                className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
              >
                <div className="relative">
                  <img
                    src={featuredTopic.heroImageUrl}
                    alt={featuredTopic.title}
                    className="h-52 w-full object-cover transition duration-500 group-hover:scale-105 md:h-72"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/92 px-3 py-1 text-xs font-black text-slate-900 shadow-sm">
                        主焦點
                      </span>
                      <span className="rounded-full bg-slate-950/60 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                        {featuredTopic.category}
                      </span>
                      {featuredTopic.sourceQuality && (
                        <span className="rounded-full bg-emerald-300/90 px-3 py-1 text-xs font-black text-emerald-950">
                          {featuredTopic.sourceQuality.label}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight text-white md:text-5xl">
                      {featuredTopic.title}
                    </h2>
                  </div>
                </div>

                <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_220px] md:p-6">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">
                      AI 快讀
                    </div>
                    {featuredTopic.quickSummary ? (
                      <p className="mt-2 text-base leading-7 text-slate-700">
                        {featuredTopic.quickSummary}
                      </p>
                    ) : (
                      <p className="mt-2 text-base leading-7 text-slate-500">
                        系統正在整理這個主題的快速摘要。
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
                    <div className="rounded-2xl bg-rose-50 px-3 py-3 text-center text-rose-700">
                      <div className="text-xs font-semibold text-rose-500">熱度</div>
                      <div className="mt-1 text-xl font-black">
                        {featuredTopic.heatScore}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center text-slate-700">
                      <div className="text-xs font-semibold text-slate-500">來源</div>
                      <div className="mt-1 text-xl font-black">
                        {featuredTopic.sourceCount}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-blue-50 px-3 py-3 text-center text-blue-700">
                      <div className="text-xs font-semibold text-blue-500">文章</div>
                      <div className="mt-1 text-xl font-black">
                        {featuredTopic.articleCount}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              {secondaryTopics.map((topic, index) => (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  className="group rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                      {index + 2}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                          {topic.category}
                        </span>
                        {topic.sourceQuality && (
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getSourceQualityClass(
                              topic.sourceQuality.tone
                            )}`}
                          >
                            {topic.sourceQuality.label}
                          </span>
                        )}
                        <span className="text-xs font-medium text-slate-400">
                          {formatRelativeTime(topic.updatedAt)}
                        </span>
                      </div>
                      <h2 className="mt-2 line-clamp-2 text-lg font-black leading-snug text-slate-950">
                        {topic.title}
                      </h2>
                      {topic.quickSummary && (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                          {topic.quickSummary}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
                          熱度 {topic.heatScore}
                        </span>
                        <div>
                          {topic.sourceCount} 家媒體 ｜ {topic.articleCount} 篇原始文章
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
