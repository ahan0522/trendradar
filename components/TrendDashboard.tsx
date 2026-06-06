"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  BookOpenText,
  Clock3,
  Cpu,
  ExternalLink,
  Filter,
  Flame,
  Search,
  TrendingUp,
  Globe2,
  HeartPulse,
  Newspaper,
  Gamepad2,
  Plane,
  MonitorSmartphone,
  ShieldAlert,
  Trophy,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { categories, mockTopics } from "@/data/mock-topics";
import type { TrendCategory, TrendTopic } from "@/types/trend";
import { scoreBadgeClass } from "@/lib/trend-score";
import { TrendBar } from "@/components/TrendBar";

const categoryIcon: Record<TrendCategory, React.ComponentType<{ className?: string }>> = {
  國際: Globe2,
  台海: ShieldAlert,
  新聞: Newspaper,
  政治: MessageCircle,
  生活: HeartPulse,
  體育: Trophy,
  科技: Cpu,
  "3C": MonitorSmartphone,
  遊戲: Gamepad2,
  旅遊: Plane,
  動漫: Sparkles,
  文化: BookOpenText,
  娛樂: Flame,
  財經: BarChart3,
  AI: Sparkles,
};

function Button({ children, variant = "solid" }: { children: React.ReactNode; variant?: "solid" | "outline" }) {
  return (
    <button
      className={
        variant === "solid"
          ? "inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          : "inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      }
    >
      {children}
    </button>
  );
}

export function TrendDashboard() {
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("全部");
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<TrendTopic>(mockTopics[0]);

  const filteredTopics = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mockTopics.filter((topic) => {
      const matchCategory = activeCategory === "全部" || topic.category === activeCategory;
      const matchQuery =
        !q ||
        topic.title.toLowerCase().includes(q) ||
        topic.category.toLowerCase().includes(q) ||
        topic.region.toLowerCase().includes(q) ||
        topic.summary.toLowerCase().includes(q) ||
        topic.sources.join(" ").toLowerCase().includes(q);
      return matchCategory && matchQuery;
    });
  }, [activeCategory, query]);

  const topCategories = useMemo(() => {
    const map = new Map<string, { category: string; count: number; avg: number }>();
    mockTopics.forEach((topic) => {
      const current = map.get(topic.category) || { category: topic.category, count: 0, avg: 0 };
      current.count += 1;
      current.avg += topic.score;
      map.set(topic.category, current);
    });
    return Array.from(map.values())
      .map((item) => ({ ...item, avg: Math.round(item.avg / item.count) }))
      .sort((a, b) => b.avg - a.avg);
  }, []);

  const SelectedIcon = categoryIcon[selectedTopic.category] || Flame;

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
              <Flame className="h-4 w-4" /> 今日熱門話題雷達
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">TrendRadar</h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              快速掌握國際、新聞、政治、體育、3C、遊戲、旅遊、動漫等熱門討論，並用趨勢分數判斷什麼正在升溫。
            </p>
          </div>
          <div className="flex gap-2">
            <Button><Bell className="mr-2 h-4 w-4" /> 建立追蹤</Button>
            <Link href="/topics" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">即時話題</Link>
            <Link href="/news" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">RSS 新聞</Link>
            <Button variant="outline">匯出簡報</Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="今日監測話題" value="1,284" caption="+18.6% vs 昨日" />
          <StatCard label="最高熱度" value="94" caption="AI 手機新功能" />
          <StatCard label="最快成長" value="+312%" caption="遊戲大型更新" />
          <StatCard label="資料來源" value="8" caption="新聞 / 社群 / 搜尋 / RSS" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <main className="min-w-0 space-y-4">
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜尋話題、分類、來源，例如：AI、旅遊、巴哈、政治"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none transition focus:border-slate-400"
                  />
                </div>
                <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> 進階篩選</Button>
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                      activeCategory === category
                        ? "bg-slate-950 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredTopics.map((topic, index) => (
                <TrendTopicCard
                  key={topic.id}
                  topic={topic}
                  index={index}
                  active={selectedTopic.id === topic.id}
                  onSelect={() => setSelectedTopic(topic)}
                />
              ))}
              {filteredTopics.length === 0 && (
                <div className="rounded-3xl bg-white p-8 text-center text-slate-500 shadow-sm">找不到符合條件的話題。</div>
              )}
            </div>
          </main>

          <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <SelectedIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-slate-500">話題詳情</div>
                    <h2 className="break-words text-2xl font-black leading-tight">{selectedTopic.title}</h2>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${scoreBadgeClass(selectedTopic.score)}`}>
                  {selectedTopic.score}
                </span>
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
                <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                  <Sparkles className="h-4 w-4" /> AI 摘要
                </div>
                <p className="leading-7 text-slate-100">{selectedTopic.summary}</p>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold">主要討論點</h3>
                <div className="mt-3 space-y-2">
                  {selectedTopic.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                      <TrendingUp className="h-4 w-4 text-slate-500" /> {bullet}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold">資料來源</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTopic.sources.map((source) => (
                    <span key={source} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                      {source} <ExternalLink className="h-3 w-3" />
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold">分類熱度</h3>
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
              </div>
            </section>
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

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function TrendTopicCard({ topic, index, active, onSelect }: { topic: TrendTopic; index: number; active: boolean; onSelect: () => void }) {
  const Icon = categoryIcon[topic.category] || Flame;
  return (
    <motion.button
      onClick={onSelect}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`w-full rounded-3xl border p-4 text-left shadow-sm transition ${
        active ? "border-slate-900 bg-white" : "border-transparent bg-white hover:border-slate-200"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">#{index + 1}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{topic.category}</span>
            <span className="flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              <Clock3 className="mr-1 h-3 w-3" /> {topic.updatedAt}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold">{topic.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{topic.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${scoreBadgeClass(topic.score)}`}>
              熱度 {topic.score}
            </span>
            <span className="text-sm text-green-700">+{topic.velocity}%</span>
            <span className="text-sm text-slate-500">{topic.region}</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
