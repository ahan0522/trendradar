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

  useEffect(() => {
    fetch("/api/topics/db-home")
      .then((res) => res.json())
      .then((data) => setTopics(data.topics ?? []))
      .catch((err) => console.error("Failed to load topics:", err));
  }, []);

  return (
    <main className="min-h-screen bg-white p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          今日熱門大主題
        </h1>

        <p className="mt-2 max-w-2xl text-slate-500">
          系統會自動抓取新聞、整理相近事件，並以大主題方式呈現今日最熱門焦點。
        </p>

        {topics.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <div className="text-xl font-semibold text-slate-700">
              目前還沒有可顯示的大主題
            </div>
            <p className="mt-2 text-sm text-slate-500">
              系統正在整理最新新聞，請稍後再重新整理。
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/topics/${topic.slug}`}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
              >
                <div className="relative">
                  <img
                    src={topic.heroImageUrl}
                    alt={topic.title}
                    className="h-80 w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                </div>

                <div className="grid gap-5 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="space-y-3">
                    <div>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-600">
                        {topic.category}
                      </span>
                    </div>

                    <h2 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 md:text-4xl">
                      {topic.title}
                    </h2>
                  </div>

                  <div className="border-t border-slate-100 pt-4 md:min-w-44 md:border-t-0 md:pt-0 md:text-right">
                    <div className="space-y-1 text-sm leading-6 text-slate-500">
                      <div>熱度 {topic.heatScore}</div>
                      <div>
                        {topic.sourceCount} 家媒體 ｜ {topic.articleCount} 篇文章
                      </div>
                      <div>{formatRelativeTime(topic.updatedAt)}</div>
                    </div>

                    <div className="mt-5 text-sm font-medium text-slate-800 transition group-hover:translate-x-1">
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
