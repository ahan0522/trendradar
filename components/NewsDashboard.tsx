"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Newspaper, RefreshCw, Search } from "lucide-react";
import { categories } from "@/data/mock-topics";
import type { NewsItem } from "@/types/news";

function formatDate(value: string | null) {
  if (!value) return "時間未知";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NewsDashboard() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [category, setCategory] = useState<(typeof categories)[number]>("全部");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ category, limit: "80" });
    if (query.trim()) params.set("q", query.trim());
    return `/api/news?${params.toString()}`;
  }, [category, query]);

  async function loadNews(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const url = refresh ? `${endpoint}&refresh=1` : endpoint;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "新聞載入失敗");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "新聞載入失敗");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNews(false);
  }, [endpoint]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            <Newspaper className="h-4 w-4" /> RSS 新聞資料測試版
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">TrendRadar News</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            這一頁會即時讀取 RSS 新聞來源，先用它測試真實資料擷取。之後可以把新聞量、關鍵字與社群資料合併成趨勢分數。
          </p>
        </header>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋新聞，例如：AI、台積電、遊戲、旅遊"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none transition focus:border-slate-400"
              />
            </div>
            <button
              onClick={() => loadNews(true)}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              重新抓取
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                  category === item ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {error && <div className="rounded-3xl bg-red-50 p-4 text-sm text-red-700 shadow-sm">{error}</div>}

        <section className="space-y-3">
          {loading && items.length === 0 && <div className="rounded-3xl bg-white p-8 text-center text-slate-500 shadow-sm">正在讀取 RSS 新聞...</div>}

          {!loading && items.length === 0 && !error && (
            <div className="rounded-3xl bg-white p-8 text-center text-slate-500 shadow-sm">目前沒有符合條件的新聞。</div>
          )}

          {items.map((item) => (
            <article key={item.id} className="rounded-3xl bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.category}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.sourceName}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{formatDate(item.publishedAt)}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{item.region}</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold leading-snug">{item.title}</h2>
              {item.description && <p className="mt-2 line-clamp-2 leading-7 text-slate-600">{item.description}</p>}
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
              >
                開啟原文 <ExternalLink className="ml-1 h-4 w-4" />
              </a>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
