"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

type HomepageTopic = {
  id: string;
  slug: string;
  title: string;
  category: string;
  heatScore: number;
  sourceCount: number;
  articleCount: number;
  updatedAt: string;
  discoveryMode?: string;
  summary?: string;
  keywords?: string[];
  detailUrl?: string;
  articles?: Array<{
    id: string;
    title: string;
    description?: string;
    quickSummary?: string;
    category?: string;
    region?: string;
    sourceName?: string;
    publishedAt?: string | null;
  }>;
};

type TopicDetail = {
  summary?: string;
  bullets?: string[];
  category?: string;
  heatScore?: number;
  sourceCount?: number;
  articleCount?: number;
  tags?: string[];
  subtopics?: string[];
  keywords?: string[];
  articles?: Array<{
    id: string;
    title: string;
    description?: string;
    quickSummary?: string;
    category?: string;
    region?: string;
    sourceName?: string;
    publishedAt?: string | null;
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
  { lat: 2, lon: -128 },
  { lat: -44, lon: -92 },
  { lat: 58, lon: 154 },
  { lat: -8, lon: 146 },
  { lat: 12, lon: 8 },
  { lat: -34, lon: 28 },
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
  [
    { lat: 16, lon: -146 },
    { lat: -18, lon: -112 },
  ],
  [
    { lat: -28, lon: -118 },
    { lat: -58, lon: -68 },
  ],
  [
    { lat: 72, lon: 136 },
    { lat: 42, lon: 174 },
  ],
  [
    { lat: 14, lon: 128 },
    { lat: -30, lon: 166 },
  ],
  [
    { lat: 28, lon: -10 },
    { lat: -10, lon: 18 },
  ],
  [
    { lat: -18, lon: 8 },
    { lat: -52, lon: 46 },
  ],
];

const LOW_SIGNAL_WORDS = new Set([
  "AI",
  "ai",
  "3C",
  "3c",
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
  "google",
  "News",
  "news",
  "Yahoo",
  "yahoo",
  "綜合",
  "分類",
  "類別",
  "國際",
  "全球",
  "科技",
  "3C科技",
  "財經",
  "體育",
  "運動",
  "遊戲",
  "健康",
  "生活",
  "社會",
  "政治",
  "international",
  "finance",
  "sports",
  "technology",
  "tech",
]);

const STAR_POINTS = [
  { x: 84, y: 76, r: 1.1, opacity: 0.48 },
  { x: 152, y: 548, r: 1.3, opacity: 0.34 },
  { x: 205, y: 118, r: 0.9, opacity: 0.28 },
  { x: 287, y: 604, r: 1.0, opacity: 0.34 },
  { x: 342, y: 58, r: 1.5, opacity: 0.46 },
  { x: 512, y: 96, r: 1.1, opacity: 0.32 },
  { x: 612, y: 562, r: 1.4, opacity: 0.42 },
  { x: 692, y: 162, r: 1.0, opacity: 0.3 },
  { x: 736, y: 438, r: 1.2, opacity: 0.36 },
  { x: 96, y: 384, r: 0.9, opacity: 0.26 },
  { x: 558, y: 632, r: 0.8, opacity: 0.24 },
  { x: 732, y: 68, r: 1.0, opacity: 0.3 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTopicColor(heatScore: number, index: number) {
  if (heatScore >= 420) return "#fb7185";
  if (heatScore >= 260) return "#f97316";
  if (heatScore >= 140) return "#f43f5e";
  return index % 2 === 0 ? "#38bdf8" : "#a78bfa";
}

function getTopicFillId(heatScore: number) {
  if (heatScore >= 420) return "topic-fill-hot";
  if (heatScore >= 260) return "topic-fill-warm";
  if (heatScore >= 140) return "topic-fill-red";
  return "topic-fill-cool";
}

function getShortestRotationDelta(current: number, target: number) {
  return ((((target - current) % 360) + 540) % 360) - 180;
}

function normalizeSignal(signal: string) {
  return signal
    .replace(/Google News/g, "")
    .replace(/Yahoo新聞/g, "")
    .replace(/[「」『』()（）《》]/g, "")
    .trim();
}

function isLowSignalWord(signal: string) {
  const normalized = normalizeSignal(signal);
  return (
    !normalized ||
    LOW_SIGNAL_WORDS.has(normalized) ||
    LOW_SIGNAL_WORDS.has(normalized.toLowerCase()) ||
    /^(ai|3c|新聞|國際|財經|體育|遊戲|健康|科技|分類|類別)$/i.test(normalized)
  );
}

function splitTopicWords(text: string) {
  return text
    .replace(/[｜:：,，!！?？、\n]/g, " ")
    .split(/\s+/)
    .map(normalizeSignal)
    .filter((word) => word.length >= 2 && !isLowSignalWord(word));
}

function pushSignals(target: string[], signals: Array<string | undefined>) {
  signals.forEach((signal) => {
    if (!signal) return;
    const normalized = normalizeSignal(signal);
    if (isLowSignalWord(normalized)) return;
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
  pushSignals(signals, splitTopicWords(topic.title));
  return signals.filter((signal) => !isLowSignalWord(signal)).slice(0, 2);
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

function getBriefItems(detail: TopicDetail | undefined, fallback: string) {
  const candidates = [
    ...(detail?.bullets ?? []),
    ...(detail?.subtopics ?? []),
    ...(detail?.articles ?? []).map(
      (article) => article.quickSummary || article.description || article.title
    ),
    fallback,
  ];

  return candidates
    .map((item) =>
      item
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^AI\s*快讀摘要[:：]?\s*/i, "")
        .trim()
    )
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((next) => next === item) === index)
    .slice(0, 3)
    .map((item) => truncateText(item, 42));
}

function getInsightChips(topic: HomepageTopic, detail?: TopicDetail) {
  const chips: string[] = [];
  pushSignals(chips, [
    detail?.category || topic.category,
    ...(detail?.tags ?? []),
    ...(detail?.keywords ?? []),
    ...(detail?.subtopics ?? []),
  ]);

  return chips.slice(0, 6);
}

function getSourceNames(detail?: TopicDetail) {
  const sourceNames = (detail?.articles ?? [])
    .map((article) => article.sourceName?.trim())
    .filter((sourceName): sourceName is string => Boolean(sourceName));

  return sourceNames.filter(
    (sourceName, index, list) => list.findIndex((item) => item === sourceName) === index
  );
}

function getRepresentativeEvents(detail?: TopicDetail) {
  return (detail?.articles ?? [])
    .map((article) => ({
      id: article.id,
      text: article.quickSummary || article.description || article.title,
      sourceName: article.sourceName,
    }))
    .filter((article) => Boolean(article.text))
    .slice(0, 2)
    .map((article) => ({
      ...article,
      text: truncateText(article.text.replace(/\s+/g, " ").trim(), 46),
    }));
}

function getPointRadius(
  point: ReturnType<typeof projectPoint>,
  minHeatScore: number,
  maxHeatScore: number
) {
  if (point.kind === "topic") {
    const heatRatio = clamp(
      ((point.heatScore ?? minHeatScore) - minHeatScore) /
        Math.max(maxHeatScore - minHeatScore, 1),
      0,
      1
    );
    return clamp(28 + heatRatio * 26, 28, 54);
  }

  return point.kind === "shared" ? 22 : 15;
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
  const [rotationTarget, setRotationTarget] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [dragState, setDragState] = useState<{
    startX: number;
    startRotation: number;
    moved: boolean;
  } | null>(null);
  const rotationRef = useRef(0);
  const rotationTargetRef = useRef<number | null>(null);
  const velocityRef = useRef(0);
  const lastDragXRef = useRef(0);
  const dragMovedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/topics/globe-home")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const nextTopics = (data.topics ?? []).slice(0, 12);
        setTopics(nextTopics);
        setSelectedTopicId(nextTopics[0]?.id ?? null);
        const inlineDetails = Object.fromEntries(
          nextTopics.map((topic: HomepageTopic) => [
            topic.slug,
            {
              summary: topic.summary,
              category: topic.category,
              keywords: topic.keywords ?? [],
              articles: topic.articles ?? [],
            } satisfies TopicDetail,
          ])
        );
        setDetailsBySlug(inlineDetails);

        return Promise.all(
          nextTopics
            .filter((topic: HomepageTopic) =>
              !topic.discoveryMode?.startsWith("globe_")
            )
            .map((topic: HomepageTopic) =>
              fetch(`/api/topics/db/${encodeURIComponent(topic.slug)}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((detailData) => [topic.slug, detailData?.topic ?? {}])
              .catch(() => [topic.slug, {}])
            )
        );
      })
      .then((detailEntries) => {
        if (cancelled || !detailEntries) return;
        setDetailsBySlug((current) => ({
          ...current,
          ...Object.fromEntries(detailEntries),
        }));
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
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    rotationTargetRef.current = rotationTarget;
  }, [rotationTarget]);

  useEffect(() => {
    if (dragState) return;
    let frame = 0;

    function tick() {
      const inertia = velocityRef.current;
      const autoSpin = paused || focusMode ? 0 : 0.18;
      const target = rotationTargetRef.current;
      const targetDelta =
        target === null
          ? 0
          : getShortestRotationDelta(rotationRef.current, target);
      const focusSpin =
        target === null
          ? 0
          : Math.abs(targetDelta) < 0.2
            ? targetDelta
            : targetDelta * 0.09;

      if (autoSpin || focusSpin || Math.abs(inertia) > 0.01) {
        const nextRotation =
          (rotationRef.current + autoSpin + focusSpin + inertia + 360) % 360;
        rotationRef.current = nextRotation;
        setRotation(nextRotation);
        velocityRef.current *= 0.94;
        if (Math.abs(velocityRef.current) < 0.01) velocityRef.current = 0;
        if (target !== null && Math.abs(targetDelta) < 0.2) {
          rotationTargetRef.current = null;
          setRotationTarget(null);
        }
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, focusMode, dragState]);

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    velocityRef.current = 0;
    rotationTargetRef.current = null;
    setRotationTarget(null);
    lastDragXRef.current = event.clientX;
    dragMovedRef.current = false;
    setDragState({
      startX: event.clientX,
      startRotation: rotation,
      moved: false,
    });
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragState) return;
    const deltaX = event.clientX - dragState.startX;
    const frameDelta = event.clientX - lastDragXRef.current;

    velocityRef.current = frameDelta * 0.24;
    lastDragXRef.current = event.clientX;
    const nextRotation = (dragState.startRotation + deltaX * 0.45 + 360) % 360;
    rotationRef.current = nextRotation;
    setRotation(nextRotation);
    if (Math.abs(deltaX) > 4 && !dragState.moved) {
      dragMovedRef.current = true;
      setDragState({ ...dragState, moved: true });
    }
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!dragState?.moved && !dragMovedRef.current) {
      selectNearestTopic(event);
    }
    window.setTimeout(() => {
      setDragState(null);
      dragMovedRef.current = false;
    }, 0);
  }

  function selectNearestTopic(event: PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current ?? event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 800;
    const pointerY = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 680;
    let nearestPoint: ReturnType<typeof projectPoint> | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const point of projectedPoints) {
      if (point.kind !== "topic" || !point.visible) continue;
      const radius =
        getPointRadius(point, minHeatScore, maxHeatScore) * point.scale + 18;
      const distance = Math.hypot(point.x - pointerX, point.y - pointerY);
      if (distance > radius) continue;
      if (distance < nearestDistance) {
        nearestPoint = point;
        nearestDistance = distance;
      }
    }

    if (!nearestPoint) {
      setFocusMode(false);
      setPaused(false);
      setRotationTarget(null);
      rotationTargetRef.current = null;
      return;
    }
    velocityRef.current = 0;
    const targetRotation = (360 - nearestPoint.lon) % 360;
    rotationTargetRef.current = targetRotation;
    setRotationTarget(targetRotation);
    setSelectedTopicId(nearestPoint.id);
    setFocusMode(true);
    setPaused(true);
  }

  const points = useMemo<GlobePoint[]>(() => {
    const topicPoints = topics.map((topic, index) => ({
      id: topic.id,
      label: getShortTitle(topic.title),
      kind: "topic" as const,
      topicIndex: index,
      slug: topic.slug,
      heatScore: topic.heatScore,
      color: getTopicColor(topic.heatScore, index),
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
  const selectedBriefItems = getBriefItems(selectedDetail, selectedSummary);
  const selectedInsightChips = selectedTopic
    ? getInsightChips(selectedTopic, selectedDetail)
    : [];
  const selectedSourceNames = getSourceNames(selectedDetail);
  const selectedEvents = getRepresentativeEvents(selectedDetail);
  const selectedDetailHref = selectedTopic
    ? selectedTopic.detailUrl || `/topics/${selectedTopic.slug}`
    : "/";
  const maxHeatScore = Math.max(...topics.map((topic) => topic.heatScore), 1);
  const minHeatScore = Math.min(
    ...topics.map((topic) => topic.heatScore),
    maxHeatScore
  );

  if (loading) {
    return (
      <div className="h-[680px] animate-pulse rounded-[36px] border border-white/10 bg-white/5" />
    );
  }

  return (
    <div
      className={`grid gap-5 transition-all duration-500 ${
        focusMode ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_340px]"
      }`}
    >
      <section className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/30">
        <div
          className={`flex flex-wrap items-center justify-between gap-3 overflow-hidden border-b border-white/10 px-5 transition-all duration-500 ${
            focusMode
              ? "max-h-0 py-0 opacity-0"
              : "max-h-40 py-4 opacity-100"
          }`}
        >
          <div>
            <div className="text-sm font-semibold text-sky-300">
              Trend Globe
            </div>
            <h2 className="mt-1 text-2xl font-black">全球議題正在轉動</h2>
            <p className="mt-1 text-sm text-slate-400">
              航線代表主題、共同脈絡與子訊號之間的連結；拖曳地球可旋轉，點熱門節點會放大並顯示主題快讀。
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

        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_48%_42%,_#1e3a8a_0,_#0f172a_42%,_#020617_74%,_#000_100%)]">
          <svg
            ref={svgRef}
            viewBox="0 0 800 680"
            role="img"
            aria-label="旋轉地球村主題圖"
            className={`h-[620px] w-full touch-none select-none transition-transform duration-500 ${
              focusMode ? "scale-[1.2] sm:h-[720px] sm:scale-[1.14]" : "scale-100"
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
                <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.72" />
                <stop offset="36%" stopColor="#2563eb" stopOpacity="0.32" />
                <stop offset="72%" stopColor="#0f172a" stopOpacity="0.86" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0.98" />
              </radialGradient>
              <radialGradient id="atmosphere-fill" cx="50%" cy="50%" r="50%">
                <stop offset="68%" stopColor="#38bdf8" stopOpacity="0" />
                <stop offset="86%" stopColor="#38bdf8" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.36" />
              </radialGradient>
              <radialGradient id="topic-fill-hot" cx="34%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.82" />
                <stop offset="24%" stopColor="#fb7185" />
                <stop offset="62%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#7f1d1d" />
              </radialGradient>
              <radialGradient id="topic-fill-warm" cx="34%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#ffedd5" stopOpacity="0.82" />
                <stop offset="34%" stopColor="#f97316" />
                <stop offset="74%" stopColor="#e11d48" />
                <stop offset="100%" stopColor="#4c0519" />
              </radialGradient>
              <radialGradient id="topic-fill-red" cx="34%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#ffe4e6" stopOpacity="0.82" />
                <stop offset="36%" stopColor="#fb7185" />
                <stop offset="78%" stopColor="#be123c" />
                <stop offset="100%" stopColor="#4c0519" />
              </radialGradient>
              <radialGradient id="topic-fill-cool" cx="34%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.86" />
                <stop offset="36%" stopColor="#38bdf8" />
                <stop offset="76%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#1e1b4b" />
              </radialGradient>
              <linearGradient id="route-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
                <stop offset="46%" stopColor="#93c5fd" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.34" />
              </linearGradient>
              <linearGradient id="route-hot" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.3" />
                <stop offset="48%" stopColor="#fef3c7" stopOpacity="1" />
                <stop offset="100%" stopColor="#fb7185" stopOpacity="0.42" />
              </linearGradient>
              <pattern
                id="data-texture"
                width="36"
                height="36"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 0 18 H 36 M 18 0 V 36"
                  stroke="#7dd3fc"
                  strokeOpacity="0.08"
                  strokeWidth="0.8"
                />
                <circle cx="18" cy="18" r="1.1" fill="#bae6fd" opacity="0.16" />
              </pattern>
              <clipPath id="globe-clip">
                <circle cx="400" cy="340" r={focusMode ? "304" : "286"} />
              </clipPath>
              <filter id="globe-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="24"
                  floodColor="#38bdf8"
                  floodOpacity="0.28"
                />
              </filter>
              <filter id="node-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="8"
                  floodColor="#67e8f9"
                  floodOpacity="0.48"
                />
              </filter>
              <filter id="route-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="3"
                  floodColor="#7dd3fc"
                  floodOpacity="0.32"
                />
              </filter>
            </defs>

            <g opacity="0.95">
              {STAR_POINTS.map((star, index) => (
                <circle
                  key={`${star.x}-${star.y}`}
                  cx={star.x + Math.sin(rotation / 42 + index) * 4}
                  cy={star.y + Math.cos(rotation / 58 + index) * 2}
                  r={star.r}
                  fill="#e0f2fe"
                  opacity={star.opacity}
                />
              ))}
            </g>

            <circle
              cx="400"
              cy="340"
              r={focusMode ? "336" : "318"}
              fill="url(#atmosphere-fill)"
              opacity={focusMode ? "0.9" : "0.68"}
              className="transition-all duration-500"
            />
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
            <g clipPath="url(#globe-clip)" opacity={focusMode ? "0.42" : "0.28"}>
              <rect
                x="70"
                y="20"
                width="660"
                height="640"
                fill="url(#data-texture)"
                transform={`translate(${(rotation % 36) - 18} 0)`}
              />
              <path
                d="M 146 264 C 240 206, 304 458, 436 392 S 610 238, 688 332"
                fill="none"
                stroke="#67e8f9"
                strokeOpacity="0.16"
                strokeWidth="2"
                strokeDasharray="4 12"
              />
              <path
                d="M 116 418 C 256 352, 344 534, 492 472 S 628 384, 704 428"
                fill="none"
                stroke="#a78bfa"
                strokeOpacity="0.12"
                strokeWidth="2"
                strokeDasharray="2 10"
              />
            </g>
            {[-60, -30, 0, 30, 60].map((lat) => (
              <ellipse
                key={lat}
                cx="400"
                cy={340 - lat * 2.2}
                rx={270 * Math.cos((lat * Math.PI) / 180)}
                ry="26"
                fill="none"
                stroke="#93c5fd"
                strokeOpacity={lat === 0 ? "0.26" : "0.15"}
                strokeDasharray="2 9"
                strokeLinecap="round"
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
                strokeOpacity={index % 2 === 0 ? "0.13" : "0.08"}
                strokeDasharray="2 10"
                strokeLinecap="round"
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
                    stroke={isSelected ? "url(#route-hot)" : "url(#route-blue)"}
                    strokeWidth={
                      isSelected
                        ? clamp(2.6 + route.strength / 90, 3, 5.2)
                        : clamp(1.2 + route.strength / 140, 1.5, 2.5)
                    }
                    strokeLinecap="round"
                    strokeDasharray={isSelected ? "1 0" : "7 9"}
                    filter={isSelected ? "url(#route-glow)" : undefined}
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
                const radius = getPointRadius(
                  point,
                  minHeatScore,
                  maxHeatScore
                );
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
                      if (dragState?.moved || dragMovedRef.current) return;
                      if (point.kind === "topic") {
                        velocityRef.current = 0;
                        const targetRotation = (360 - point.lon) % 360;
                        rotationTargetRef.current = targetRotation;
                        setRotationTarget(targetRotation);
                        setSelectedTopicId(point.id);
                        setFocusMode(true);
                        setPaused(true);
                      }
                    }}
                  >
                    {point.kind === "topic" && (
                      <circle
                        cx={point.x}
                        cy={point.y}
                      r={radius * point.scale * 1.35}
                      fill={point.color}
                        opacity={point.id === selectedTopicId ? "0.32" : "0.14"}
                        className="animate-ping"
                      />
                    )}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={radius * point.scale * 1.16}
                      fill="none"
                      stroke={point.color}
                      strokeOpacity={point.kind === "topic" ? "0.42" : "0.2"}
                      strokeWidth={point.kind === "topic" ? 2 : 1}
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={radius * point.scale}
                      fill={
                        point.kind === "topic"
                          ? `url(#${getTopicFillId(point.heatScore ?? 0)})`
                          : point.color
                      }
                      stroke={point.kind === "shared" ? "#94a3b8" : "#f8fafc"}
                      strokeOpacity="0.82"
                      strokeWidth={point.kind === "topic" ? 3 : 1.5}
                      filter={point.kind === "topic" ? "url(#node-glow)" : undefined}
                    />
                    <circle
                      cx={point.x - radius * point.scale * 0.28}
                      cy={point.y - radius * point.scale * 0.32}
                      r={radius * point.scale * 0.22}
                      fill="#ffffff"
                      opacity={point.kind === "shared" ? "0.38" : "0.46"}
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

            {focusMode && selectedTopic && selectedPoint?.visible && (
              <foreignObject
                x={focusMode ? 226 : clamp(selectedPoint.x + 34, 90, 520)}
                y={focusMode ? 152 : clamp(selectedPoint.y - 92, 56, 478)}
                width={focusMode ? "382" : "250"}
                height={focusMode ? "438" : "158"}
                className="pointer-events-none hidden sm:block"
              >
                <div
                  className={`border border-cyan-200/20 bg-slate-950/72 text-white shadow-2xl shadow-cyan-950/40 backdrop-blur-xl ring-1 ring-white/10 ${
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
                    {truncateText(selectedSummary, focusMode ? 178 : 78)}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="rounded-2xl bg-rose-400/15 px-2 py-2 text-rose-100">
                      <div className="text-rose-100/60">熱度</div>
                      <div className="mt-0.5 font-black">{selectedTopic.heatScore}</div>
                    </div>
                    <div className="rounded-2xl bg-cyan-300/15 px-2 py-2 text-cyan-100">
                      <div className="text-cyan-100/60">來源</div>
                      <div className="mt-0.5 font-black">
                        {selectedSourceNames.length || selectedTopic.sourceCount}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/10 px-2 py-2 text-slate-100">
                      <div className="text-slate-300">事件</div>
                      <div className="mt-0.5 font-black">{selectedTopic.articleCount}</div>
                    </div>
                  </div>
                  {focusMode && (
                    <div className="mt-3 space-y-2">
                      {selectedBriefItems.map((item, index) => (
                        <div
                          key={`${item}-${index}`}
                          className="flex gap-2 rounded-2xl bg-white/[0.08] px-3 py-2 text-xs leading-5 text-slate-200"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-300/20 text-[10px] font-black text-cyan-100">
                            {index + 1}
                          </span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedEvents.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-400">
                        代表事件
                      </div>
                      {selectedEvents.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2 text-xs leading-5 text-slate-200"
                        >
                          {event.text}
                          {event.sourceName && (
                            <span className="ml-2 text-[11px] text-cyan-200/80">
                              {event.sourceName}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {focusMode && selectedInsightChips.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {selectedInsightChips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full bg-sky-400/15 px-2.5 py-1 text-[11px] font-semibold text-sky-100"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </foreignObject>
            )}
          </svg>

          {focusMode && selectedTopic && (
            <div className="absolute inset-x-3 bottom-3 max-h-[58%] overflow-y-auto rounded-[28px] border border-cyan-100/20 bg-slate-950/62 p-4 text-white shadow-2xl shadow-cyan-950/40 backdrop-blur-2xl ring-1 ring-white/10 sm:hidden">
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/30" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-cyan-200">快速快讀</div>
                  <h3 className="mt-1 text-lg font-black leading-tight">
                    {selectedTopic.title}
                  </h3>
                </div>
                <div className="shrink-0 rounded-full bg-rose-400/20 px-3 py-1 text-xs font-bold text-rose-100">
                  熱度 {selectedTopic.heatScore}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-2xl bg-white/10 px-2 py-2">
                  <div className="text-slate-400">分類</div>
                  <div className="mt-0.5 truncate font-bold">
                    {selectedDetail?.category || selectedTopic.category || "綜合"}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/10 px-2 py-2">
                  <div className="text-slate-400">來源</div>
                  <div className="mt-0.5 font-bold">
                    {selectedSourceNames.length || selectedTopic.sourceCount}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/10 px-2 py-2">
                  <div className="text-slate-400">事件</div>
                  <div className="mt-0.5 font-bold">{selectedTopic.articleCount}</div>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {selectedBriefItems.map((item, index) => (
                  <div
                    key={`${item}-mobile-${index}`}
                    className="flex gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm leading-6 text-slate-100"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-300/20 text-[10px] font-black text-cyan-100">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              {selectedEvents.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedEvents.slice(0, 1).map((event) => (
                    <div
                      key={`${event.id}-mobile-event`}
                      className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs leading-5 text-slate-200"
                    >
                      {event.text}
                      {event.sourceName && (
                        <span className="ml-2 text-cyan-200/80">
                          {event.sourceName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {selectedInsightChips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedInsightChips.slice(0, 5).map((chip) => (
                    <span
                      key={`${chip}-mobile`}
                      className="rounded-full bg-sky-400/15 px-2.5 py-1 text-[11px] font-semibold text-sky-100"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
              <Link
                href={selectedDetailHref}
                className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-slate-200"
              >
                深入閱讀
              </Link>
            </div>
          )}

          {focusMode && selectedTopic && (
            <div className="absolute bottom-5 left-1/2 hidden w-[min(92%,620px)] -translate-x-1/2 items-center justify-between gap-3 rounded-full border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white shadow-2xl shadow-black/30 backdrop-blur sm:flex">
              <span className="truncate text-slate-300">
                正在聚焦：<span className="font-semibold text-white">{selectedTopic.title}</span>
              </span>
              <Link
                href={selectedDetailHref}
                className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-slate-200"
              >
                進入詳情
              </Link>
            </div>
          )}
        </div>
      </section>

      <aside
        className={`space-y-4 transition-all duration-500 ${
          focusMode ? "hidden lg:hidden" : "block"
        }`}
      >
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
                href={selectedDetailHref}
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
              這版先用 3D-like SVG 做出資料星球：有大氣外光、點狀網格、資料紋理、拖曳慣性與熱度分級節點，成本低且不用新增大型套件。
            </p>
            <p>
              航線已用貝茲曲線呈現主題、共同脈絡與子訊號；線條粗細和亮度可以繼續連到關聯強度、來源數與更新速度。
            </p>
            <p>
              之後若要做真正 3D 轉動、縮放、飛線粒子與節點懸浮，可以再升級成 Three.js。
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
