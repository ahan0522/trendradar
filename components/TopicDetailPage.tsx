"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock3, ExternalLink, RefreshCw, TrendingUp } from "lucide-react";
import { TrendBar } from "@/components/TrendBar";
import { scoreBadgeClass } from "@/lib/trend-score";
import type { TopicDetail } from "@/types/topic-detail";

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

export function TopicDetailPage({ topicId }: { topicId: string }) {
  const [data, setData] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/db/topics/${topicId}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "讀取話題詳情失敗");
      }
      setData(payload as TopicDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取話題詳情失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
  }, [topicId]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-8 text-slate-600">正在載入話題詳情...</div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">讀取失敗</div>
          <p className="mt-2 text-slate-600">{error ?? "找不到這個話題。"}</p>
          <div className="mt-6 flex gap-3">
            <Link href="/topics" className="rounded-2xl bg-slate-950 px-4 py-2 text-white">
              回熱門話題
            </Link>
            <button onClick={loadDetail} className="rounded-2xl border border-slate-200 px-4 py-2 text-slate-700">
              重新整理
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { topic, relatedArticles, sourceStats, metricsTimeline, lastSyncedAt } = data;

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
              <Clock3 className="h-4 w-4" /> 最後同步 {formatTime(lastSyncedAt)}
            </div>
            <h1 className="mt-3 text-3xl font-bold md:text-4xl">{topic.title}</h1>
            <p className="mt-2 text-slate-600">話題詳情頁會彙整分數、來源、時間線與相關文章，方便你判斷這個話題為什麼正在升溫。</p>
          </div>
          <div className="flex gap-2">
            <Link href="/topics" className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> 回熱門話題
            </Link>
            <button onClick={loadDetail} className="inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2 text-sm text-white shadow-sm">
              <RefreshCw className="mr-2 h-4 w-4" /> 重新整理
            </button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="熱度分數" value={String(topic.score)} caption={topic.category} />
          <StatCard label="速度" value={String(topic.velocity)} caption={topic.region} />
          <StatCard label="相關文章" value={String(relatedArticles.length)} caption="本頁顯示的文章數" />
          <StatCard label="來源數" value={String(sourceStats.length)} caption={topic.sentiment} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <main className="space-y-4">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${scoreBadgeClass(topic.score)}`}>熱度 {topic.score}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{topic.category}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{topic.region}</span>
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">趨勢分數</span>
                  <span>{topic.score}/100</span>
                </div>
                <TrendBar value={topic.score} />
              </div>
              <div className="mt-6 rounded-3xl bg-slate-950 p-5 text-white">
                <div className="text-sm text-slate-300">AI 摘要</div>
                <p className="mt-2 leading-7">{topic.summary}</p>
              </div>
              <div className="mt-6">
                <h2 className="font-semibold">主要判斷依據</h2>
                <div className="mt-3 space-y-2">
                  {topic.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <TrendingUp className="h-4 w-4 text-slate-500" /> {bullet}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">相關文章</h2>
              <div className="mt-4 space-y-3">
                {relatedArticles.map((article) => (
                  <a
                    key={article.id}
                    href={article.link}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-slate-500">{article.sourceName} · {formatTime(article.publishedAt)}</div>
                        <div className="mt-1 font-semibold">{article.title}</div>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{article.description}</p>
                      </div>
                      <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                    </div>
                  </a>
                ))}
                {relatedArticles.length === 0 && <div className="text-sm text-slate-500">目前沒有找到相關文章。</div>}
              </div>
            </div>
          </main>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">來源分布</h2>
              <div className="mt-4 space-y-4">
                {sourceStats.map((item) => (
                  <div key={item.sourceName}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{item.sourceName}</span>
                      <span className="text-slate-500">{item.count}</span>
                    </div>
                    <TrendBar value={Math.min(100, item.count * 20)} />
                  </div>
                ))}
                {sourceStats.length === 0 && <div className="text-sm text-slate-500">尚無來源資料。</div>}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">熱度時間線</h2>
              <div className="mt-4 space-y-3">
                {metricsTimeline.map((point) => (
                  <div key={point.measuredAt} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span>{formatTime(point.measuredAt)}</span>
                      <span className="font-semibold text-slate-700">總分 {point.totalScore}</span>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      <div>速度分數：{point.velocityScore}</div>
                      <div>新聞分數：{point.newsScore}</div>
                    </div>
                  </div>
                ))}
                {metricsTimeline.length === 0 && <div className="text-sm text-slate-500">尚無時間線資料。</div>}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
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
