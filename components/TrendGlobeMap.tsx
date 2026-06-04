"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type PointerEvent } from "react";

type HomepageTopic = {
  id: string;
  slug: string;
  title: string;
  category: string;
  heatScore: number;
  sourceCount: number;
  articleCount: number;
  updatedAt: string;
};

type TopicDetail = {
  summary?: string;
  tags?: string[];
  subtopics?: string[];
  keywords?: string[];
  articles?: Array<{
    id: string;
    title: string;
    description?: string;
    quickSummary?: string;
  }>;
};

type GlobePoint = {
  id: string;
  label: string;
  kind: "topic" | "signal" | "shared";
  topicIndex?: number;
  slug?: string;
  heatScore?: number;
  lat: number;
  lon: number;
  color: string;
};

type GlobeRoute = {
  id: string;
  fromId: string;
  toId: string;
  topicId?: string;
  strength: number;
};

const TOPIC_COORDS = [
  { lat: 18, lon: -72 },
  { lat: 42, lon: -24 },
  { lat: 24, lon: 36 },
  { lat: -16, lon: 76 },
  { lat: -24, lon: -18 },
  { lat: 44, lon: 96 },
];

const SIGNAL_COORDS = [
  [
    { lat: 31, lon: -88 },
    { lat: 5, lon: -58 },
  ],
  [
    { lat: 58, lon: -38 },
    { lat: 28, lon: -4 },
  ],
  [
    { lat: 38, lon: 22 },
    { lat: 8, lon: 54 },
  ],
  [
    { lat: -2, lon: 94 },
    { lat: -38, lon: 58 },
  ],
  [
    { lat: -6, lon: -38 },
    { lat: -42, lon: -2 },
  ],
  [
    { lat: 62, lon: 82 },
    { lat: 30, lon: 118 },
  ],
];

const LOW_SIGNAL_WORDS = new Set([
  "新聞",
  "即時",
  "最新",
  "熱門",
  "焦點",
  "今日",
  "媒體",
  "報導",
  "來源",
  "相關",
  "Google",
  "News",
  "Yahoo",
  "國際",
  "科技",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSignal(signal: string) {
  return signal
    .replace(/Google News/g, "")
    .replace(/Yahoo新聞/g, "")
    .replace(/[「」『』()（）《》]/g, "")
    .trim();
}

function splitTopicWords(text: string) {
  return text
    .replace(/[｜:：,，!！?？、\n]/g, " ")
    .split(/\s+/)
    .map(normalizeSignal)
    .filter((word) => word.length >= 2 && !LOW_SIGNAL_WORDS.has(word));
}

function pushSignals(target: string[], signals: Array<string | undefined>) {
  signals.forEach((signal) => {
    if (!signal) return;
    const normalized = normalizeSignal(signal);
    if (!normalized || LOW_SIGNAL_WORDS.has(normalized)) return;
    if (!target.includes(normalized)) target.push(normalized);
  });
}

function getTopicSignals(topic: HomepageTopic, detail?: TopicDetail) {
  const signals: string[] = [];
  pushSignals(signals, detail?.subtopics ?? []);
  pushSignals(signals, detail?.keywords ?? []);
  pushSignals(signals, detail?.tags ?? []);
  pushSignals(signals, splitTopicWords(detail?.summary ?? "").slice(0, 3));
  detail?.articles?.slice(0, 3).forEach((article) => {
    pushSignals(signals, splitTopicWords(article.quickSummary ?? "").slice(0, 2));
    pushSignals(signals, splitTopicWords(article.title).slice(0, 1));
  });
  pushSignals(signals, [topic.category, ...splitTopicWords(topic.title)]);
  return signals.filter((signal) => signal !== topic.category).slice(0, 2);
}

function getShortTitle(title: string) {
  return title
    .replace("發布審查政策", "審查政策")
    .replace("發表動態", "動態")
    .replace("平台發表", "平台")
    .slice(0, 12);
}

function projectPoint(point: GlobePoint, rotation: number) {
  const lat = (point.lat * Math.PI) / 180;
  const lon = ((point.lon + rotation) * Math.PI) / 180;
  const x3 = Math.cos(lat) * Math.sin(lon);
  const y3 = Math.sin(lat);
  const z3 = Math.cos(lat) * Math.cos(lon);
  const scale = 0.72 + (z3 + 1) * 0.22;

  return {
    ...point,
    x: 400 + x3 * 270 * scale,
    y: 340 - y3 * 210 * scale,
    z: z3,
    scale,
    visible: z3 > -0.62,
  };
}

function getRoutePath(
  from: ReturnType<typeof projectPoint>,
  to: ReturnType<typeof projectPoint>
) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const curve = clamp(distance * 0.18, 24, 72);
  const controlX = midX - (dy / Math.max(distance, 1)) * curve;
  const controlY = midY + (dx / Math.max(distance, 1)) * curve - 18;

  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${controlX.toFixed(
    1
  )} ${controlY.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

function splitLabel(label: string, maxLength = 6) {
  if (label.length <= maxLength) return [label];
  return [label.slice(0, maxLength), label.slice(maxLength, maxLength * 2)];
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export default function TrendGlobeMap() {
  const [topics, setTopics] = useState<HomepageTopic[]>([]);
  const [detailsBySlug, setDetailsBySlug] = useState<Record<string, TopicDetail>>(
    {}
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragState, setDragState] = useState<{
    startX: number;
    startRotation: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/topics/db-home")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const nextTopics = (data.topics ?? []).slice(0, 6);
        setTopics(nextTopics);
        setSelectedTopicId(nextTopics[0]?.id ?? null);

        return Promise.all(
          nextTopics.map((topic: HomepageTopic) =>
            fetch(`/api/topics/db/${encodeURIComponent(topic.slug)}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((detailData) => [topic.slug, detailData?.topic ?? {}])
              .catch(() => [topic.slug, {}])
          )
        );
      })
      .then((detailEntries) => {
        if (cancelled || !detailEntries) return;
        setDetailsBySlug(Object.fromEntries(detailEntries));
      })
      .catch((err) => console.error("Failed to load trend globe:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (paused || dragState) return;
    let frame = 0;

    function tick() {
      setRotation((value) => (value + 0.18) % 360);
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, dragState]);

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      startX: event.clientX,
      startRotation: rotation,
      moved: false,
    });
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragState) return;
    const deltaX = event.clientX - dragState.startX;

    setRotation((dragState.startRotation + deltaX * 0.45 + 360) % 360);
    if (Math.abs(deltaX) > 4 && !dragState.moved) {
      setDragState({ ...dragState, moved: true });
    }
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    window.setTimeout(() => setDragState(null), 0);
  }

  const points = useMemo<GlobePoint[]>(() => {
    const topicPoints = topics.map((topic, index) => ({
      id: topic.id,
      label: getShortTitle(topic.title),
      kind: "topic" as const,
      topicIndex: index,
      slug: topic.slug,
      heatScore: topic.heatScore,
      color: "#ef4444",
      ...TOPIC_COORDS[index % TOPIC_COORDS.length],
    }));

    const signalPoints = topics.flatMap((topic, topicIndex) =>
      getTopicSignals(topic, detailsBySlug[topic.slug]).map((label, signalIndex) => ({
        id: `${topic.id}-${label}`,
        label,
        kind: "signal" as const,
        topicIndex,
        color: "#38bdf8",
        ...SIGNAL_COORDS[topicIndex % SIGNAL_COORDS.length][signalIndex],
      }))
    );

    const sharedPoints: GlobePoint[] = [
      {
        id: "shared-global",
        label: "地球村",
        kind: "shared",
        lat: 8,
        lon: 24,
        color: "#f8fafc",
      },
      {
        id: "shared-discussion",
        label: "今日焦點",
        kind: "shared",
        lat: 0,
        lon: 62,
        color: "#e2e8f0",
      },
    ];

    return [...sharedPoints, ...signalPoints, ...topicPoints];
  }, [topics, detailsBySlug]);

  const projectedPoints = useMemo(
    () =>
      points
        .map((point) => projectPoint(point, rotation))
        .sort((a, b) => a.z - b.z),
    [points, rotation]
  );

  const pointById = useMemo(
    () => new Map(projectedPoints.map((point) => [point.id, point])),
    [projectedPoints]
  );

  const routes = useMemo<GlobeRoute[]>(() => {
    const nextRoutes: GlobeRoute[] = [];

    topics.forEach((topic) => {
      nextRoutes.push({
        id: `${topic.id}-discussion`,
        fromId: topic.id,
        toId: "shared-discussion",
        topicId: topic.id,
        strength: topic.heatScore * 0.75,
      });

      if (topic.id === selectedTopicId) {
        nextRoutes.push({
          id: `${topic.id}-global`,
          fromId: topic.id,
          toId: "shared-global",
          topicId: topic.id,
          strength: topic.heatScore,
        });
      }

      getTopicSignals(topic, detailsBySlug[topic.slug]).forEach((label) => {
        nextRoutes.push({
          id: `${topic.id}-${label}-route`,
          fromId: topic.id,
          toId: `${topic.id}-${label}`,
          topicId: topic.id,
          strength: topic.heatScore * 0.55,
        });
      });
    });

    return nextRoutes;
  }, [topics, detailsBySlug, selectedTopicId]);

  const selectedTopic =
    topics.find((topic) => topic.id === selectedTopicId) ?? topics[0];
  const selectedTopicIndex = selectedTopic
    ? topics.findIndex((topic) => topic.id === selectedTopic.id)
    : -1;
  const selectedDetail = selectedTopic
    ? detailsBySlug[selectedTopic.slug]
    : undefined;
  const selectedPoint = selectedTopic ? pointById.get(selectedTopic.id) : null;
  const selectedSummary =
    selectedDetail?.summary ||
    selectedDetail?.articles?.[0]?.quickSummary ||
    selectedDetail?.articles?.[0]?.description ||
    "正在整理這個主題的快讀摘要。";

  if (loading) {
    return (
      <div className="h-[680px] animate-pulse rounded-[36px] border border-white/10 bg-white/5" />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/30">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-sky-300">
              Globe Prototype
            </div>
            <h2 className="mt-1 text-2xl font-black">全球議題正在轉動</h2>
            <p className="mt-1 text-sm text-slate-400">
              航線代表主題、共同脈絡與子訊號之間的連結；點紅色主題會放大地球並顯示主題快讀。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {focusMode && (
              <button
                type="button"
                onClick={() => setFocusMode(false)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                返回全局
              </button>
            )}
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
            >
              {paused ? "繼續轉動" : "暫停旋轉"}
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_center,_#1e3a8a_0,_#0f172a_46%,_#020617_100%)]">
          <svg
            viewBox="0 0 800 680"
            role="img"
            aria-label="旋轉地球村主題圖"
            className={`h-[620px] w-full touch-none select-none transition-transform duration-500 ${
              focusMode ? "scale-[1.16]" : "scale-100"
            } ${
              dragState ? "cursor-grabbing" : "cursor-grab"
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <defs>
              <radialGradient id="globe-fill" cx="38%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.62" />
                <stop offset="46%" stopColor="#1d4ed8" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0.92" />
              </radialGradient>
              <filter id="globe-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="24"
                  floodColor="#38bdf8"
                  floodOpacity="0.28"
                />
              </filter>
            </defs>

            <circle
              cx="400"
              cy="340"
              r={focusMode ? "304" : "286"}
              fill="url(#globe-fill)"
              stroke="#7dd3fc"
              strokeOpacity={focusMode ? "0.46" : "0.28"}
              strokeWidth={focusMode ? "3" : "2"}
              filter="url(#globe-glow)"
              className="transition-all duration-500"
            />
            {[-60, -30, 0, 30, 60].map((lat) => (
              <ellipse
                key={lat}
                cx="400"
                cy={340 - lat * 2.2}
                rx={270 * Math.cos((lat * Math.PI) / 180)}
                ry="26"
                fill="none"
                stroke="#93c5fd"
                strokeOpacity="0.18"
              />
            ))}
            {Array.from({ length: 8 }).map((_, index) => (
              <ellipse
                key={index}
                cx="400"
                cy="340"
                rx={270 * Math.abs(Math.cos((index * Math.PI) / 8))}
                ry="286"
                fill="none"
                stroke="#93c5fd"
                strokeOpacity="0.12"
              />
            ))}

            <g>
              {routes.map((route) => {
                const from = pointById.get(route.fromId);
                const to = pointById.get(route.toId);
                if (!from || !to || !from.visible || !to.visible) return null;

                const isSelected = route.topicId === selectedTopicId;
                const depthOpacity = clamp((from.z + to.z + 2) / 3.2, 0.14, 0.8);

                return (
                  <path
                    key={route.id}
                    d={getRoutePath(from, to)}
                    fill="none"
                    stroke={isSelected ? "#fef3c7" : "#93c5fd"}
                    strokeWidth={
                      isSelected
                        ? clamp(2.6 + route.strength / 90, 3, 5.2)
                        : clamp(1.2 + route.strength / 140, 1.5, 2.5)
                    }
                    strokeLinecap="round"
                    strokeDasharray={isSelected ? "1 0" : "7 9"}
                    opacity={
                      focusMode
                        ? isSelected
                          ? depthOpacity
                          : depthOpacity * 0.12
                        : isSelected
                          ? depthOpacity
                          : depthOpacity * 0.55
                    }
                  />
                );
              })}
            </g>

            {projectedPoints
              .filter((point) => point.visible)
              .map((point) => {
                const radius =
                  point.kind === "topic"
                    ? clamp(22 + (point.heatScore ?? 80) / 8, 30, 48)
                    : point.kind === "shared"
                      ? 22
                      : 15;
                const opacity = clamp(0.45 + point.z * 0.55, 0.18, 1);

                return (
                  <g
                    key={point.id}
                    opacity={
                      focusMode && point.kind === "topic" && point.id !== selectedTopicId
                        ? opacity * 0.28
                        : focusMode &&
                            point.kind === "signal" &&
                            point.topicIndex !== selectedTopicIndex
                          ? opacity * 0.72
                          : opacity
                    }
                    className={point.kind === "topic" ? "cursor-pointer" : ""}
                    onClick={() => {
                      if (dragState?.moved) return;
                      if (point.kind === "topic") {
                        setSelectedTopicId(point.id);
                        setFocusMode(true);
                        setPaused(true);
                      }
                    }}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={radius * point.scale}
                      fill={point.color}
                      stroke={point.kind === "shared" ? "#94a3b8" : "#f8fafc"}
                      strokeOpacity="0.82"
                      strokeWidth={point.kind === "topic" ? 3 : 1.5}
                    />
                    {splitLabel(point.label, point.kind === "topic" ? 5 : 4).map(
                      (line, lineIndex, lines) => (
                        <text
                          key={line}
                          x={point.x}
                          y={
                            point.y +
                            (lineIndex - (lines.length - 1) / 2) * 14 +
                            4
                          }
                          textAnchor="middle"
                          className={`pointer-events-none ${
                            point.kind === "shared"
                              ? "fill-slate-800"
                              : "fill-white"
                          } text-[11px] font-black`}
                        >
                          {line}
                        </text>
                      )
                    )}
                  </g>
                );
              })}

            {selectedTopic && selectedPoint?.visible && (
              <foreignObject
                x={focusMode ? 252 : clamp(selectedPoint.x + 34, 90, 520)}
                y={focusMode ? 206 : clamp(selectedPoint.y - 92, 56, 478)}
                width={focusMode ? "296" : "250"}
                height={focusMode ? "236" : "158"}
                className="pointer-events-none"
              >
                <div
                  className={`border border-white/15 bg-slate-950/82 text-white shadow-2xl shadow-black/35 backdrop-blur ${
                    focusMode ? "rounded-[28px] p-5" : "rounded-2xl p-3"
                  }`}
                >
                  <div className="text-xs font-semibold text-sky-300">
                    {focusMode ? "主題展開" : "球上快讀"}
                  </div>
                  <div
                    className={`mt-1 font-black leading-snug ${
                      focusMode ? "text-xl" : "text-sm"
                    }`}
                  >
                    {selectedTopic.title}
                  </div>
                  <p
                    className={`mt-2 leading-6 text-slate-300 ${
                      focusMode ? "text-sm" : "text-xs"
                    }`}
                  >
                    {truncateText(selectedSummary, focusMode ? 138 : 78)}
                  </p>
                  {focusMode && selectedDetail?.subtopics && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {selectedDetail.subtopics.slice(0, 4).map((subtopic) => (
                        <span
                          key={subtopic}
                          className="rounded-full bg-sky-400/15 px-2.5 py-1 text-[11px] font-semibold text-sky-100"
                        >
                          {subtopic}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2 text-[11px] text-slate-300">
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-100">
                      熱度 {selectedTopic.heatScore}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5">
                      {selectedTopic.articleCount} 篇
                    </span>
                  </div>
                </div>
              </foreignObject>
            )}
          </svg>

          {focusMode && selectedTopic && (
            <div className="absolute bottom-5 left-1/2 flex w-[min(92%,620px)] -translate-x-1/2 items-center justify-between gap-3 rounded-full border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white shadow-2xl shadow-black/30 backdrop-blur">
              <span className="truncate text-slate-300">
                正在聚焦：<span className="font-semibold text-white">{selectedTopic.title}</span>
              </span>
              <Link
                href={`/topics/${selectedTopic.slug}`}
                className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-slate-200"
              >
                進入詳情
              </Link>
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20">
          <div className="text-sm font-semibold text-sky-300">目前選取</div>
          {selectedTopic ? (
            <>
              <h2 className="mt-2 text-2xl font-black leading-tight">
                {selectedTopic.title}
              </h2>
              {selectedDetail?.summary && (
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {selectedDetail.summary}
                </p>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-2xl bg-red-500/15 p-3 text-red-100">
                  <div className="text-xs text-red-200/75">熱度</div>
                  <div className="mt-1 font-black">{selectedTopic.heatScore}</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 text-slate-100">
                  <div className="text-xs text-slate-300">媒體</div>
                  <div className="mt-1 font-black">
                    {selectedTopic.sourceCount}
                  </div>
                </div>
                <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-100">
                  <div className="text-xs text-sky-200/75">文章</div>
                  <div className="mt-1 font-black">
                    {selectedTopic.articleCount}
                  </div>
                </div>
              </div>
              <Link
                href={`/topics/${selectedTopic.slug}`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                查看主題詳情
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-400">請點選一個紅色主題。</p>
          )}
        </section>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20">
          <div className="text-sm font-semibold text-sky-300">目前判斷</div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
            <p>
              這版是 3D-like SVG 投影，已經有旋轉、遠近大小、節點點選與航線連結，成本低且不需要新增套件。
            </p>
            <p>
              航線可以用來表達主題與共同脈絡的關係；下一步可讓線條粗細代表關聯強度。
            </p>
            <p>
              如果要做真正可拖曳、縮放、慣性旋轉的地球，下一版可以升級成 Three.js。
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
