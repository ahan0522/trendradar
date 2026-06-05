"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TaiwanRegion =
  | "north"
  | "central"
  | "south"
  | "east"
  | "offshore"
  | "strait"
  | "nationwide";

type TaiwanTopic = {
  id: string;
  slug: string;
  title: string;
  category: string;
  region: TaiwanRegion;
  regionLabel: string;
  heatScore: number;
  sourceCount: number;
  articleCount: number;
  summary: string;
  keywords?: string[];
  detailUrl?: string;
  articles?: Array<{
    id: string;
    title: string;
    sourceName: string;
    quickSummary?: string;
    publishedAt: string | null;
  }>;
};

const REGION_POINTS: Record<TaiwanRegion, { x: number; y: number; label: string }> = {
  north: { x: 412, y: 118, label: "北部" },
  central: { x: 336, y: 266, label: "中部" },
  south: { x: 314, y: 470, label: "南部" },
  east: { x: 514, y: 326, label: "東部" },
  offshore: { x: 152, y: 350, label: "離島" },
  strait: { x: 186, y: 236, label: "台海" },
  nationwide: { x: 402, y: 292, label: "全台" },
};

const CATEGORY_COLORS: Record<string, string> = {
  台海與國際: "#38bdf8",
  天氣與防災: "#22c55e",
  政策與財經: "#f59e0b",
  交通與生活: "#a78bfa",
  科技與產業: "#06b6d4",
  體育: "#fb7185",
  社會與生活: "#f97316",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function getTopicPosition(topic: TaiwanTopic, index: number, siblings: TaiwanTopic[]) {
  const regionPoint = REGION_POINTS[topic.region] ?? REGION_POINTS.nationwide;
  const sameRegionIndex = siblings
    .filter((item) => item.region === topic.region)
    .findIndex((item) => item.id === topic.id);
  const angle = -Math.PI / 2 + sameRegionIndex * 1.45 + index * 0.13;
  const distance = topic.region === "nationwide" ? 54 : 44 + sameRegionIndex * 16;

  return {
    x: regionPoint.x + Math.cos(angle) * distance,
    y: regionPoint.y + Math.sin(angle) * distance,
  };
}

function getRoutePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const curve = clamp(distance * 0.18, 18, 62);
  const controlX = midX - (dy / distance) * curve;
  const controlY = midY + (dx / distance) * curve;

  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${controlX.toFixed(
    1
  )} ${controlY.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? "#38bdf8";
}

export default function TaiwanRoutesMap() {
  const [topics, setTopics] = useState<TaiwanTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/topics/taiwan-home")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const nextTopics = (data.topics ?? []).slice(0, 12);
        setTopics(nextTopics);
        setSelectedTopicId(nextTopics[0]?.id ?? null);
      })
      .catch((error) => console.error("Failed to load Taiwan routes:", error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const positionedTopics = useMemo(
    () =>
      topics.map((topic, index) => ({
        ...topic,
        ...getTopicPosition(topic, index, topics),
      })),
    [topics]
  );

  const selectedTopic =
    positionedTopics.find((topic) => topic.id === selectedTopicId) ??
    positionedTopics[0];
  const maxHeat = Math.max(1, ...topics.map((topic) => topic.heatScore));

  if (loading) {
    return (
      <section className="grid min-h-[560px] place-items-center rounded-[32px] border border-white/10 bg-slate-950/70 text-slate-300">
        正在整理台灣新聞航線...
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-slate-950 p-3 shadow-2xl shadow-sky-950/30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_18%,rgba(56,189,248,0.24),transparent_34%),radial-gradient(circle_at_30%_72%,rgba(34,197,94,0.16),transparent_28%)]" />
        <svg
          viewBox="0 0 760 640"
          role="img"
          aria-label="台灣新聞航線圖"
          className="relative z-10 min-h-[560px] w-full"
          onClick={() => setSelectedTopicId(null)}
        >
          <defs>
            <filter id="taiwan-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="taiwan-route" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.08" />
              <stop offset="55%" stopColor="#67e8f9" stopOpacity="0.62" />
              <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.22" />
            </linearGradient>
          </defs>

          <g opacity="0.42">
            {Array.from({ length: 11 }).map((_, index) => (
              <path
                key={`grid-x-${index}`}
                d={`M 64 ${72 + index * 48} C 260 ${60 + index * 48}, 480 ${
                  90 + index * 42
                }, 696 ${72 + index * 48}`}
                fill="none"
                stroke="#38bdf8"
                strokeDasharray="2 14"
                strokeOpacity="0.14"
              />
            ))}
          </g>

          <path
            d="M 432 44 C 478 78 496 128 488 178 C 530 230 548 286 526 350 C 496 438 452 516 392 586 C 350 552 332 486 304 438 C 280 396 252 354 266 302 C 280 250 320 220 318 170 C 316 108 354 66 432 44 Z"
            fill="#0f172a"
            stroke="#bae6fd"
            strokeOpacity="0.8"
            strokeWidth="3"
            filter="url(#taiwan-glow)"
          />
          <path
            d="M 420 82 C 452 116 458 176 436 228 C 414 278 418 334 438 388 C 452 426 430 486 392 540"
            fill="none"
            stroke="#67e8f9"
            strokeOpacity="0.24"
            strokeWidth="2"
            strokeDasharray="6 12"
          />
          <path
            d="M 336 134 C 382 168 428 188 500 184 M 306 286 C 374 316 438 320 526 302 M 318 442 C 374 466 432 460 488 424"
            fill="none"
            stroke="#e0f2fe"
            strokeOpacity="0.13"
            strokeWidth="2"
          />

          {Object.entries(REGION_POINTS).map(([region, point]) => (
            <g key={region}>
              <circle
                cx={point.x}
                cy={point.y}
                r={region === "nationwide" ? 13 : 9}
                fill="#f8fafc"
                opacity={region === "nationwide" ? "0.68" : "0.42"}
              />
              <text
                x={point.x + 14}
                y={point.y + 4}
                className="fill-slate-200 text-[12px] font-bold"
              >
                {point.label}
              </text>
            </g>
          ))}

          {positionedTopics.map((topic) => {
            const regionPoint = REGION_POINTS[topic.region] ?? REGION_POINTS.nationwide;
            const isSelected = selectedTopic?.id === topic.id;

            return (
              <path
                key={`${topic.id}-route`}
                d={getRoutePath(regionPoint, topic)}
                fill="none"
                stroke={isSelected ? getCategoryColor(topic.category) : "url(#taiwan-route)"}
                strokeWidth={isSelected ? 4 : 2}
                strokeDasharray={isSelected ? "1 0" : "8 10"}
                strokeLinecap="round"
                opacity={selectedTopic && !isSelected ? 0.18 : 0.72}
              />
            );
          })}

          {positionedTopics.map((topic, index) => {
            const color = getCategoryColor(topic.category);
            const heatRatio = topic.heatScore / maxHeat;
            const radius = clamp(17 + heatRatio * 17, 17, 34);
            const isSelected = selectedTopic?.id === topic.id;

            return (
              <g
                key={topic.id}
                className="cursor-pointer"
                opacity={selectedTopic && !isSelected ? 0.48 : 1}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedTopicId(topic.id);
                }}
              >
                <circle
                  cx={topic.x}
                  cy={topic.y}
                  r={radius * 1.75}
                  fill={color}
                  opacity={isSelected ? "0.24" : "0.1"}
                  className={isSelected ? "animate-ping" : ""}
                />
                <circle
                  cx={topic.x}
                  cy={topic.y}
                  r={radius}
                  fill={color}
                  stroke="#f8fafc"
                  strokeOpacity="0.92"
                  strokeWidth="3"
                  filter="url(#taiwan-glow)"
                />
                <text
                  x={topic.x}
                  y={topic.y + 4}
                  textAnchor="middle"
                  className="pointer-events-none fill-white text-[11px] font-black"
                >
                  {index + 1}
                </text>
                <text
                  x={topic.x}
                  y={topic.y + radius + 18}
                  textAnchor="middle"
                  className="pointer-events-none fill-slate-100 text-[11px] font-bold"
                >
                  {topic.regionLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </section>

      <aside className="space-y-4">
        <section className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5 text-white shadow-xl shadow-black/20">
          <div className="text-sm font-semibold text-sky-300">目前選取</div>
          {selectedTopic ? (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-100">
                  {selectedTopic.regionLabel}
                </span>
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: getCategoryColor(selectedTopic.category) }}
                >
                  {selectedTopic.category}
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-black leading-tight">
                {selectedTopic.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {selectedTopic.summary}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-2xl bg-rose-500/15 p-3 text-rose-100">
                  <div className="text-xs text-rose-200/75">熱度</div>
                  <div className="mt-1 font-black">{selectedTopic.heatScore}</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 text-slate-100">
                  <div className="text-xs text-slate-300">來源</div>
                  <div className="mt-1 font-black">{selectedTopic.sourceCount}</div>
                </div>
                <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-100">
                  <div className="text-xs text-sky-200/75">訊號</div>
                  <div className="mt-1 font-black">{selectedTopic.articleCount}</div>
                </div>
              </div>
              {selectedTopic.keywords && selectedTopic.keywords.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedTopic.keywords.slice(0, 6).map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full bg-sky-400/15 px-2.5 py-1 text-[11px] font-semibold text-sky-100"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 space-y-2">
                {(selectedTopic.articles ?? []).slice(0, 2).map((article) => (
                  <div
                    key={article.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs leading-5 text-slate-200"
                  >
                    {truncateText(article.quickSummary || article.title, 76)}
                    <span className="ml-2 text-cyan-200/80">
                      {article.sourceName}
                    </span>
                  </div>
                ))}
              </div>
              {selectedTopic.detailUrl && (
                <Link
                  href={selectedTopic.detailUrl}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                >
                  查看來源
                </Link>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              點選地圖上的航線節點，就能看該主題快讀。
            </p>
          )}
        </section>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5 text-sm leading-6 text-slate-300 shadow-xl shadow-black/20">
          <div className="font-semibold text-sky-300">設計判斷</div>
          <p className="mt-2">
            這版不是把新聞硬切縣市，而是先保留主題，再用地區提示決定點位。全台政策放中央，台海與國防放海峽，豪雨或交通再往北中南東定位。
          </p>
        </section>
      </aside>
    </div>
  );
}
