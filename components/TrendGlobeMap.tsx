"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

const TOPIC_COORDS = [
  { lat: 18, lon: -138 },
  { lat: 45, lon: -55 },
  { lat: 23, lon: 118 },
  { lat: -24, lon: 32 },
  { lat: -4, lon: -18 },
  { lat: 48, lon: 138 },
];

const SIGNAL_COORDS = [
  [
    { lat: 32, lon: -165 },
    { lat: 4, lon: -116 },
  ],
  [
    { lat: 63, lon: -28 },
    { lat: 28, lon: -15 },
  ],
  [
    { lat: 38, lon: 145 },
    { lat: 5, lon: 103 },
  ],
  [
    { lat: -8, lon: 60 },
    { lat: -48, lon: 20 },
  ],
  [
    { lat: 16, lon: 4 },
    { lat: -28, lon: -42 },
  ],
  [
    { lat: 66, lon: 158 },
    { lat: 28, lon: 170 },
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

function splitLabel(label: string, maxLength = 6) {
  if (label.length <= maxLength) return [label];
  return [label.slice(0, maxLength), label.slice(maxLength, maxLength * 2)];
}

export default function TrendGlobeMap() {
  const [topics, setTopics] = useState<HomepageTopic[]>([]);
  const [detailsBySlug, setDetailsBySlug] = useState<Record<string, TopicDetail>>(
    {}
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [paused, setPaused] = useState(false);

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
    if (paused) return;
    let frame = 0;

    function tick() {
      setRotation((value) => (value + 0.18) % 360);
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused]);

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
        lat: 0,
        lon: 0,
        color: "#f8fafc",
      },
      {
        id: "shared-discussion",
        label: "今日焦點",
        kind: "shared",
        lat: 10,
        lon: 78,
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

  const selectedTopic =
    topics.find((topic) => topic.id === selectedTopicId) ?? topics[0];
  const selectedDetail = selectedTopic
    ? detailsBySlug[selectedTopic.slug]
    : undefined;

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
          </div>
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
          >
            {paused ? "繼續轉動" : "暫停旋轉"}
          </button>
        </div>

        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_center,_#1e3a8a_0,_#0f172a_46%,_#020617_100%)]">
          <svg
            viewBox="0 0 800 680"
            role="img"
            aria-label="旋轉地球村主題圖"
            className="h-[620px] w-full"
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
              r="286"
              fill="url(#globe-fill)"
              stroke="#7dd3fc"
              strokeOpacity="0.28"
              strokeWidth="2"
              filter="url(#globe-glow)"
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
                    opacity={opacity}
                    className={point.kind === "topic" ? "cursor-pointer" : ""}
                    onClick={() => {
                      if (point.kind === "topic") setSelectedTopicId(point.id);
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
          </svg>
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
              這版是 3D-like SVG 投影，已經有旋轉、遠近大小和節點點選，成本低且不需要新增套件。
            </p>
            <p>
              如果要做真正可拖曳、縮放、慣性旋轉的地球，下一版可以升級成 Three.js。
            </p>
            <p>
              手機版目前可看，但文字節點容易擠；後續要加入「點球後只顯示當前半球資訊」。
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
