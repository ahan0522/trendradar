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

const CATEGORY_COLORS: Record<string, string> = {
  台海與國際: "#38bdf8",
  天氣與防災: "#22c55e",
  政策與財經: "#f59e0b",
  交通與生活: "#a78bfa",
  科技與產業: "#06b6d4",
  體育: "#fb7185",
  社會與生活: "#f97316",
};

const CATEGORY_ANCHORS = [
  { category: "台海與國際", x: 178, y: 176 },
  { category: "天氣與防災", x: 414, y: 118 },
  { category: "科技與產業", x: 612, y: 208 },
  { category: "政策與財經", x: 584, y: 438 },
  { category: "交通與生活", x: 382, y: 526 },
  { category: "體育", x: 164, y: 444 },
  { category: "社會與生活", x: 112, y: 292 },
];

const TAIWAN_COASTLINE = [
  { lon: 121.43, lat: 25.31 },
  { lon: 121.66, lat: 25.28 },
  { lon: 121.86, lat: 25.12 },
  { lon: 121.93, lat: 24.86 },
  { lon: 121.84, lat: 24.55 },
  { lon: 121.73, lat: 24.22 },
  { lon: 121.64, lat: 23.9 },
  { lon: 121.52, lat: 23.58 },
  { lon: 121.42, lat: 23.25 },
  { lon: 121.27, lat: 22.91 },
  { lon: 121.08, lat: 22.54 },
  { lon: 120.92, lat: 22.19 },
  { lon: 120.78, lat: 21.92 },
  { lon: 120.62, lat: 21.9 },
  { lon: 120.43, lat: 22.16 },
  { lon: 120.24, lat: 22.52 },
  { lon: 120.13, lat: 22.91 },
  { lon: 120.07, lat: 23.25 },
  { lon: 120.1, lat: 23.56 },
  { lon: 120.18, lat: 23.88 },
  { lon: 120.23, lat: 24.15 },
  { lon: 120.36, lat: 24.43 },
  { lon: 120.55, lat: 24.69 },
  { lon: 120.78, lat: 24.93 },
  { lon: 121.05, lat: 25.15 },
  { lon: 121.25, lat: 25.28 },
];

function mapTaiwanPoint(point: { lon: number; lat: number }) {
  return {
    x: 284 + (point.lon - 120) * 88,
    y: 582 - (point.lat - 21.85) * 132,
  };
}

function buildTaiwanPath(points: typeof TAIWAN_COASTLINE) {
  return points
    .map((point, index) => {
      const mapped = mapTaiwanPoint(point);
      return `${index === 0 ? "M" : "L"} ${mapped.x.toFixed(1)} ${mapped.y.toFixed(1)}`;
    })
    .join(" ")
    .concat(" Z");
}

const TAIWAN_ISLAND_PATH = buildTaiwanPath(TAIWAN_COASTLINE);

const TAIWAN_RIDGE_PATH =
  "M 407 132 C 415 184 407 232 414 282 C 423 339 405 392 396 445 C 389 491 367 535 339 569";

const TAIWAN_WEST_COAST_HINT =
  "M 350 163 C 337 203 333 245 317 286 C 303 323 293 366 295 407 C 298 453 304 501 339 569";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? "#38bdf8";
}

function getAnchor(category: string, index: number) {
  return (
    CATEGORY_ANCHORS.find((anchor) => anchor.category === category) ??
    CATEGORY_ANCHORS[index % CATEGORY_ANCHORS.length]
  );
}

function getTopicPosition(topic: TaiwanTopic, index: number, siblings: TaiwanTopic[]) {
  const anchor = getAnchor(topic.category, index);
  const sameCategoryIndex = siblings
    .filter((item) => item.category === topic.category)
    .findIndex((item) => item.id === topic.id);
  const angle = index * 0.78 + sameCategoryIndex * 1.12;
  const distance = 34 + sameCategoryIndex * 22;

  return {
    x: anchor.x + Math.cos(angle) * distance,
    y: anchor.y + Math.sin(angle) * distance,
  };
}

function getRoutePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const curve = clamp(distance * 0.14, 18, 58);
  const controlX = midX - (dy / distance) * curve;
  const controlY = midY + (dx / distance) * curve;

  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${controlX.toFixed(
    1
  )} ${controlY.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
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
  const hub = { x: 380, y: 322 };

  if (loading) {
    return (
      <section className="grid min-h-[560px] place-items-center rounded-[32px] border border-white/10 bg-slate-950/70 text-slate-300">
        正在整理台灣今日主題...
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-slate-950 p-3 shadow-2xl shadow-sky-950/30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(56,189,248,0.22),transparent_32%),radial-gradient(circle_at_72%_18%,rgba(251,113,133,0.14),transparent_24%),radial-gradient(circle_at_18%_78%,rgba(34,197,94,0.14),transparent_26%)]" />
        <svg
          viewBox="0 0 760 640"
          role="img"
          aria-label="台灣今日主題網絡"
          className="relative z-10 min-h-[560px] w-full"
          onClick={() => setSelectedTopicId(null)}
        >
          <defs>
            <filter id="taiwan-network-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="taiwan-network-route" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.12" />
              <stop offset="55%" stopColor="#67e8f9" stopOpacity="0.58" />
              <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="taiwan-island-fill" x1="25%" y1="12%" x2="75%" y2="92%">
              <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.36" />
              <stop offset="42%" stopColor="#38bdf8" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0.58" />
            </linearGradient>
            <radialGradient id="taiwan-island-core" cx="44%" cy="40%" r="62%">
              <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.24" />
              <stop offset="56%" stopColor="#38bdf8" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.02" />
            </radialGradient>
          </defs>

          <g opacity="0.42">
            {Array.from({ length: 8 }).map((_, index) => (
              <circle
                key={`orbit-${index}`}
                cx={hub.x}
                cy={hub.y}
                r={88 + index * 34}
                fill="none"
                stroke="#38bdf8"
                strokeDasharray="2 16"
                strokeOpacity={0.11 - index * 0.008}
              />
            ))}
            {Array.from({ length: 10 }).map((_, index) => (
              <path
                key={`ray-${index}`}
                d={`M ${hub.x} ${hub.y} L ${
                  hub.x + Math.cos((index / 10) * Math.PI * 2) * 330
                } ${hub.y + Math.sin((index / 10) * Math.PI * 2) * 250}`}
                stroke="#e0f2fe"
                strokeOpacity="0.06"
              />
            ))}
          </g>

          {CATEGORY_ANCHORS.map((anchor) => {
            const color = getCategoryColor(anchor.category);
            return (
              <g key={anchor.category} opacity="0.78">
                <circle
                  cx={anchor.x}
                  cy={anchor.y}
                  r="11"
                  fill={color}
                  opacity="0.38"
                />
                <text
                  x={anchor.x}
                  y={anchor.y - 18}
                  textAnchor="middle"
                  className="fill-slate-300 text-[12px] font-bold"
                >
                  {anchor.category}
                </text>
              </g>
            );
          })}

          <g filter="url(#taiwan-network-glow)">
            <ellipse
              cx={hub.x}
              cy={hub.y + 4}
              rx="110"
              ry="178"
              fill="#38bdf8"
              opacity="0.06"
              transform={`rotate(-18 ${hub.x} ${hub.y})`}
            />
            <path
              d={TAIWAN_ISLAND_PATH}
              fill="url(#taiwan-island-fill)"
              stroke="#e0f2fe"
              strokeOpacity="0.9"
              strokeWidth="2.6"
            />
            <path
              d={TAIWAN_RIDGE_PATH}
              fill="none"
              stroke="#f8fafc"
              strokeDasharray="4 9"
              strokeLinecap="round"
              strokeOpacity="0.38"
              strokeWidth="2"
            />
            <path
              d={TAIWAN_WEST_COAST_HINT}
              fill="none"
              stroke="#7dd3fc"
              strokeLinecap="round"
              strokeOpacity="0.22"
              strokeWidth="1.5"
            />
            <path
              d={TAIWAN_ISLAND_PATH}
              fill="url(#taiwan-island-core)"
              stroke="#38bdf8"
              strokeOpacity="0.45"
              strokeWidth="6"
            />
            <g opacity="0.72">
              <circle cx="288" cy="352" r="8" fill="#e0f2fe" opacity="0.3" />
              <circle cx="271" cy="371" r="5" fill="#38bdf8" opacity="0.36" />
              <circle cx="278" cy="329" r="4" fill="#e0f2fe" opacity="0.24" />
              <circle cx="323" cy="171" r="3.5" fill="#e0f2fe" opacity="0.26" />
              <circle cx="453" cy="515" r="4.5" fill="#38bdf8" opacity="0.32" />
            </g>
            <g>
              <rect
                x="432"
                y="282"
                width="96"
                height="54"
                rx="18"
                fill="#020617"
                fillOpacity="0.66"
                stroke="#bae6fd"
                strokeOpacity="0.42"
              />
              <text
                x="480"
                y="304"
                textAnchor="middle"
                className="fill-white text-[15px] font-black"
              >
                台灣今日
              </text>
              <text
                x="480"
                y="324"
                textAnchor="middle"
                className="fill-sky-100 text-[12px] font-bold"
              >
                主題雷達
              </text>
            </g>
          </g>

          {positionedTopics.map((topic) => {
            const isSelected = selectedTopic?.id === topic.id;
            return (
              <path
                key={`${topic.id}-route`}
                d={getRoutePath(hub, topic)}
                fill="none"
                stroke={isSelected ? getCategoryColor(topic.category) : "url(#taiwan-network-route)"}
                strokeWidth={isSelected ? 4 : 2}
                strokeDasharray={isSelected ? "1 0" : "8 12"}
                strokeLinecap="round"
                opacity={selectedTopic && !isSelected ? 0.16 : 0.74}
              />
            );
          })}

          {positionedTopics.map((topic, index) => {
            const color = getCategoryColor(topic.category);
            const heatRatio = topic.heatScore / maxHeat;
            const radius = clamp(19 + heatRatio * 18, 19, 38);
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
                  filter="url(#taiwan-network-glow)"
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
                  {truncateText(topic.category.replace("與", "/"), 6)}
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
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: getCategoryColor(selectedTopic.category) }}
                >
                  {selectedTopic.category}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-100">
                  {selectedTopic.regionLabel}
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
              點選主題節點，就能看快讀摘要。
            </p>
          )}
        </section>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5 text-sm leading-6 text-slate-300 shadow-xl shadow-black/20">
          <div className="font-semibold text-sky-300">設計判斷</div>
          <p className="mt-2">
            台灣輪廓只作為今日焦點的辨識背景，不硬把新聞塞進縣市。真正的整理仍以大主題、摘要、來源去重與熱度訊號為主。
          </p>
        </section>
      </aside>
    </div>
  );
}
