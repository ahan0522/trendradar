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
  sourceCount: number;
  articleCount: number;
  updatedAt: string;
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

export default function HomePage() {
  const [topics, setTopics] = useState<HomepageTopicCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/topics/db-home")
      .then((res) => res.json())
      .then((data) => setTopics(data.topics ?? []))
      .catch((err) => console.error("Failed to load topics:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-white px-5 py-5 md:px-8 md:py-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              今日熱門大主題
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              一頁快速掌握今天最值得看的新聞焦點。
            </p>
          </div>

          {!loading && (
            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
              顯示 {topics.length} 個主題，最多 6 個
            </div>
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
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/topics/${topic.slug}`}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
              >
                <div className="relative">
                  <img
                    src={topic.heroImageUrl}
                    alt={topic.title}
                    className="h-40 w-full object-cover transition duration-300 group-hover:scale-105 md:h-44"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                </div>

                <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="space-y-2">
                    <div>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-slate-600">
                        {topic.category}
                      </span>
                    </div>

                    <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-950">
                      {topic.title}
                    </h2>
                  </div>

                  <div className="border-t border-slate-100 pt-3 md:min-w-36 md:border-t-0 md:pt-0 md:text-right">
                    <div className="space-y-0.5 text-xs leading-5 text-slate-500">
                      <div>熱度 {topic.heatScore}</div>
                      <div>
                        {topic.sourceCount} 家媒體 ｜ {topic.articleCount} 篇文章
                      </div>
                      <div>{formatRelativeTime(topic.updatedAt)}</div>
                    </div>

                    <div className="mt-3 text-sm font-medium text-slate-800 transition group-hover:translate-x-1">
                      查看主題 →
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
