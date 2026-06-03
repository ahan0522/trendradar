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
    sourceName?: string;
  }>;
};

type TopicNode = HomepageTopic & {
  x: number;
  y: number;
  radius: number;
};

type BridgeNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  topicIndexes: number[];
  score: number;
};

type SignalNode = {
  id: string;
  label: string;
  kind: SignalKind;
  x: number;
  y: number;
  topicIndex: number;
  score: number;
};

type TopicSignal = {
  label: string;
  kind: SignalKind;
  score: number;
};

type SignalKind = "person" | "place" | "event" | "org" | "concept";

const TOPIC_POSITIONS = [
  { x: 260, y: 220 },
  { x: 600, y: 170 },
  { x: 880, y: 315 },
  { x: 620, y: 520 },
  { x: 305, y: 500 },
  { x: 930, y: 535 },
];

const SIGNAL_OFFSETS = [
  [
    { x: -126, y: -82 },
    { x: -122, y: 82 },
  ],
  [
    { x: 128, y: -78 },
    { x: -118, y: -82 },
  ],
  [
    { x: 130, y: -66 },
    { x: 136, y: 72 },
  ],
  [
    { x: 126, y: 82 },
    { x: -122, y: 92 },
  ],
  [
    { x: -126, y: 74 },
    { x: 108, y: 96 },
  ],
  [
    { x: 112, y: -84 },
    { x: -98, y: 96 },
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

const PERSON_HINTS = [
  "川普",
  "拜登",
  "黃仁勳",
  "庫克",
  "馬斯克",
  "習近平",
  "賴清德",
  "普丁",
  "澤倫斯基",
];

const PLACE_HINTS = [
  "台灣",
  "台海",
  "美國",
  "中國",
  "日本",
  "烏克蘭",
  "俄羅斯",
  "東海",
  "南海",
  "華府",
];

const ORG_HINTS = [
  "OpenAI",
  "Google",
  "Apple",
  "Meta",
  "Microsoft",
  "NVIDIA",
  "輝達",
  "Sony",
  "PlayStation",
  "白宮",
  "美軍",
  "國防部",
];

const EVENT_HINTS = [
  "發布",
  "發表",
  "審查",
  "行政命令",
  "演習",
  "衝突",
  "墜毀",
  "攻擊",
  "制裁",
  "調查",
  "安全",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTopicRadius(topic: HomepageTopic) {
  return clamp(46 + Math.round(topic.heatScore / 9), 54, 78);
}

function getShortTitle(title: string) {
  return title
    .replace("發布審查政策", "審查政策")
    .replace("發表動態", "動態")
    .replace("平台發表", "平台")
    .slice(0, 12);
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

function getSignalKind(signal: string): SignalKind {
  if (PERSON_HINTS.some((hint) => signal.includes(hint))) return "person";
  if (PLACE_HINTS.some((hint) => signal.includes(hint))) return "place";
  if (ORG_HINTS.some((hint) => signal.includes(hint))) return "org";
  if (EVENT_HINTS.some((hint) => signal.includes(hint))) return "event";
  return "concept";
}

function addSignals(
  target: Map<string, TopicSignal>,
  signals: Array<string | undefined>,
  score: number
) {
  signals.forEach((signal) => {
    if (!signal) return;
    const normalized = normalizeSignal(signal);
    if (!normalized || normalized.length < 2) return;
    if (LOW_SIGNAL_WORDS.has(normalized)) return;
    const current = target.get(normalized);

    target.set(normalized, {
      label: normalized,
      kind: current?.kind ?? getSignalKind(normalized),
      score: (current?.score ?? 0) + score,
    });
  });
}

function getTopicSignals(topic: HomepageTopic, detail?: TopicDetail) {
  const signals = new Map<string, TopicSignal>();

  addSignals(signals, detail?.subtopics ?? [], 5);
  addSignals(signals, detail?.keywords ?? [], 4);
  addSignals(signals, detail?.tags ?? [], 3);

  if (detail?.summary) {
    addSignals(signals, splitTopicWords(detail.summary).slice(0, 4), 2);
  }

  detail?.articles?.slice(0, 4).forEach((article) => {
    addSignals(signals, splitTopicWords(article.quickSummary ?? ""), 2);
    addSignals(signals, splitTopicWords(article.title).slice(0, 2), 1);
  });

  addSignals(signals, [topic.category, ...splitTopicWords(topic.title)], 1);

  return Array.from(signals.values())
    .filter((signal) => signal.label !== topic.category || signals.size <= 2)
    .sort((a, b) => b.score - a.score || a.label.length - b.label.length)
    .slice(0, 3);
}

function getBridgeNodes(
  topics: HomepageTopic[],
  detailsBySlug: Record<string, TopicDetail>
): BridgeNode[] {
  const categoryMap = new Map<string, number[]>();
  const signalMap = new Map<
    string,
    { topicIndexes: number[]; score: number }
  >();

  topics.forEach((topic, index) => {
    const indexes = categoryMap.get(topic.category) ?? [];
    indexes.push(index);
    categoryMap.set(topic.category, indexes);

    getTopicSignals(topic, detailsBySlug[topic.slug]).forEach((signal) => {
      const entry = signalMap.get(signal.label) ?? {
        topicIndexes: [],
        score: 0,
      };
      if (!entry.topicIndexes.includes(index)) entry.topicIndexes.push(index);
      entry.score += signal.score + topic.heatScore / 100;
      signalMap.set(signal.label, entry);
    });
  });

  const bridges: BridgeNode[] = [
    {
      id: "news-focus",
      label: "今日焦點",
      x: 560,
      y: 340,
      topicIndexes: topics.map((_, index) => index),
      score: topics.reduce((sum, topic) => sum + topic.heatScore, 0),
    },
  ];

  Array.from(categoryMap.entries()).forEach(([category, topicIndexes]) => {
    if (topicIndexes.length < 2) return;

    const averageX =
      topicIndexes.reduce(
        (sum, index) => sum + TOPIC_POSITIONS[index % TOPIC_POSITIONS.length].x,
        0
      ) / topicIndexes.length;
    const averageY =
      topicIndexes.reduce(
        (sum, index) => sum + TOPIC_POSITIONS[index % TOPIC_POSITIONS.length].y,
        0
      ) / topicIndexes.length;

    bridges.push({
      id: `category-${category}`,
      label: `${category} 共同線`,
      x: averageX,
      y: averageY + 80,
      topicIndexes,
      score:
        topicIndexes.length * 10 +
        topicIndexes.reduce((sum, index) => sum + topics[index].heatScore / 20, 0),
    });
  });

  Array.from(signalMap.entries())
    .filter(([, entry]) => entry.topicIndexes.length >= 2)
    .sort(
      (a, b) =>
        b[1].topicIndexes.length - a[1].topicIndexes.length ||
        b[1].score - a[1].score
    )
    .slice(0, 2)
    .forEach(([signal, entry]) => {
      const { topicIndexes } = entry;
      const averageX =
        topicIndexes.reduce(
          (sum, index) =>
            sum + TOPIC_POSITIONS[index % TOPIC_POSITIONS.length].x,
          0
        ) / topicIndexes.length;
      const averageY =
        topicIndexes.reduce(
          (sum, index) =>
            sum + TOPIC_POSITIONS[index % TOPIC_POSITIONS.length].y,
          0
        ) / topicIndexes.length;

      bridges.push({
        id: `signal-${signal}`,
        label: signal,
        x: averageX * 0.72 + 560 * 0.28,
        y: averageY * 0.72 + 340 * 0.28,
        topicIndexes,
        score: entry.score + topicIndexes.length * 10,
      });
    });

  const used = new Set<string>();
  return bridges
    .filter((bridge) => {
      if (used.has(bridge.label)) return false;
      used.add(bridge.label);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function splitLabel(label: string, maxLength = 7) {
  if (label.length <= maxLength) return [label];
  return [label.slice(0, maxLength), label.slice(maxLength, maxLength * 2)];
}

function getSignalKindLabel(kind: SignalKind) {
  if (kind === "person") return "人物";
  if (kind === "place") return "地點";
  if (kind === "event") return "事件";
  if (kind === "org") return "組織";
  return "概念";
}

function getSignalKindClass(kind: SignalKind) {
  if (kind === "person") return "bg-amber-50 text-amber-700";
  if (kind === "place") return "bg-emerald-50 text-emerald-700";
  if (kind === "event") return "bg-rose-50 text-rose-700";
  if (kind === "org") return "bg-violet-50 text-violet-700";
  return "bg-blue-50 text-blue-700";
}

function getSignalColor(kind: SignalKind) {
  if (kind === "person") return "#f59e0b";
  if (kind === "place") return "#10b981";
  if (kind === "event") return "#f43f5e";
  if (kind === "org") return "#8b5cf6";
  return "#3b82f6";
}

function getSignalDarkColor(kind: SignalKind) {
  if (kind === "person") return "#92400e";
  if (kind === "place") return "#065f46";
  if (kind === "event") return "#9f1239";
  if (kind === "org") return "#4c1d95";
  return "#1e3a8a";
}

export default function TrendMoleculeMap() {
  const [topics, setTopics] = useState<HomepageTopic[]>([]);
  const [detailsBySlug, setDetailsBySlug] = useState<Record<string, TopicDetail>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

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
      .catch((err) => console.error("Failed to load trend map:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const topicNodes = useMemo<TopicNode[]>(
    () =>
      topics.map((topic, index) => ({
        ...topic,
        ...TOPIC_POSITIONS[index % TOPIC_POSITIONS.length],
        radius: getTopicRadius(topic),
      })),
    [topics]
  );

  const bridgeNodes = useMemo(
    () => getBridgeNodes(topics, detailsBySlug),
    [topics, detailsBySlug]
  );

  const signalNodes = useMemo<SignalNode[]>(
    () =>
      topicNodes.flatMap((topic, topicIndex) =>
        getTopicSignals(topic, detailsBySlug[topic.slug])
          .slice(0, 2)
          .map((signal, signalIndex) => {
          const offset =
            SIGNAL_OFFSETS[topicIndex % SIGNAL_OFFSETS.length][signalIndex] ??
            SIGNAL_OFFSETS[0][0];

          return {
            id: `${topic.id}-${signal.label}`,
            label: signal.label,
            kind: signal.kind,
            x: topic.x + offset.x,
            y: topic.y + offset.y,
            topicIndex,
            score: signal.score,
          };
        })
      ),
    [topicNodes, detailsBySlug]
  );

  const selectedTopic =
    topicNodes.find((topic) => topic.id === selectedTopicId) ?? topicNodes[0];
  const selectedDetail = selectedTopic
    ? detailsBySlug[selectedTopic.slug]
    : undefined;
  const selectedSignals = selectedTopic
    ? getTopicSignals(selectedTopic, selectedDetail).slice(0, 6)
    : [];
  const selectedBridges = bridgeNodes.filter((bridge) =>
    bridge.topicIndexes.some((index) => topicNodes[index]?.id === selectedTopic?.id)
  );

  if (loading) {
    return (
      <div className="h-[620px] animate-pulse rounded-[32px] border border-slate-200 bg-white" />
    );
  }

  if (topicNodes.length === 0) {
    return (
      <section className="rounded-[32px] border border-dashed border-slate-300 bg-white p-10 text-center">
        <div className="text-xl font-bold text-slate-700">
          目前沒有可視覺化的主題
        </div>
        <p className="mt-2 text-sm text-slate-500">
          等下一次同步完成後，這裡會產生今日主題關聯圖。
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-blue-700">
                關聯圖測試
              </div>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                今天大家在討論什麼
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-500">
              <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
                紅：大主題
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                白：共同點
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                藍：子訊號
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                色彩：訊號類型
              </span>
            </div>
          </div>
        </div>

        <div className="relative overflow-x-auto bg-[radial-gradient(circle_at_center,_#ffffff_0,_#f8fbff_48%,_#edf4ff_100%)]">
          <svg
            viewBox="0 0 1120 680"
            role="img"
            aria-label="今日主題關聯圖"
            className="h-[540px] w-[980px] max-w-none md:h-[650px] md:w-full"
          >
            <defs>
              <radialGradient id="topic-red" cx="34%" cy="25%" r="70%">
                <stop offset="0%" stopColor="#fff1f2" />
                <stop offset="38%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#991b1b" />
              </radialGradient>
              <radialGradient id="signal-blue" cx="34%" cy="25%" r="70%">
                <stop offset="0%" stopColor="#eff6ff" />
                <stop offset="42%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </radialGradient>
              <radialGradient id="bridge-white" cx="30%" cy="20%" r="75%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="58%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#94a3b8" />
              </radialGradient>
              <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow
                  dx="0"
                  dy="12"
                  stdDeviation="13"
                  floodColor="#0f172a"
                  floodOpacity="0.18"
                />
              </filter>
            </defs>

            <g opacity="0.52">
              {Array.from({ length: 11 }).map((_, index) => (
                <line
                  key={`vertical-${index}`}
                  x1={80 + index * 96}
                  y1="40"
                  x2={80 + index * 96}
                  y2="640"
                  stroke="#e2e8f0"
                />
              ))}
              {Array.from({ length: 7 }).map((_, index) => (
                <line
                  key={`horizontal-${index}`}
                  x1="40"
                  y1={70 + index * 92}
                  x2="1080"
                  y2={70 + index * 92}
                  stroke="#e2e8f0"
                />
              ))}
            </g>

            <g>
              {bridgeNodes.flatMap((bridge) =>
                bridge.topicIndexes.map((topicIndex) => {
                  const topic = topicNodes[topicIndex];
                  if (!topic) return null;
                  return (
                    <line
                      key={`${bridge.id}-${topic.id}`}
                      x1={bridge.x}
                      y1={bridge.y}
                      x2={topic.x}
                      y2={topic.y}
                      stroke="#64748b"
                      strokeWidth={selectedTopic?.id === topic.id ? 12 : 7}
                      strokeLinecap="round"
                      opacity={selectedTopic?.id === topic.id ? 0.52 : 0.28}
                    />
                  );
                })
              )}

              {signalNodes.map((signal) => {
                const topic = topicNodes[signal.topicIndex];
                if (!topic) return null;
                const isSelected = selectedTopic?.id === topic.id;
                return (
                  <line
                    key={`${signal.id}-line`}
                    x1={topic.x}
                    y1={topic.y}
                    x2={signal.x}
                    y2={signal.y}
                    stroke="#64748b"
                    strokeWidth={isSelected ? 7 : 4}
                    strokeLinecap="round"
                    opacity={isSelected ? 0.5 : 0.22}
                  />
                );
              })}
            </g>

            <g filter="url(#node-shadow)">
              {bridgeNodes.map((bridge) => (
                <g key={bridge.id}>
                  <circle
                    cx={bridge.x}
                    cy={bridge.y}
                    r={clamp(30 + bridge.score / 24, 34, 48)}
                    fill="url(#bridge-white)"
                  />
                  {splitLabel(bridge.label, 5).map((line, index, lines) => (
                    <text
                      key={line}
                      x={bridge.x}
                      y={bridge.y + (index - (lines.length - 1) / 2) * 16 + 5}
                      textAnchor="middle"
                      className="fill-slate-700 text-[13px] font-bold"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              ))}

              {signalNodes.map((signal) => {
                const topic = topicNodes[signal.topicIndex];
                const isSelected = selectedTopic?.id === topic?.id;
                return (
                  <g key={signal.id} opacity={isSelected ? 1 : 0.7}>
                    <circle
                      cx={signal.x}
                      cy={signal.y}
                      r={clamp(24 + signal.score, isSelected ? 32 : 26, 40)}
                      fill={getSignalColor(signal.kind)}
                      stroke={getSignalDarkColor(signal.kind)}
                      strokeWidth={isSelected ? 3 : 1.5}
                    />
                    {splitLabel(signal.label, 4).map((line, index, lines) => (
                      <text
                        key={line}
                        x={signal.x}
                        y={
                          signal.y + (index - (lines.length - 1) / 2) * 14 + 5
                        }
                        textAnchor="middle"
                        className="fill-white text-[12px] font-bold"
                      >
                        {line}
                      </text>
                    ))}
                  </g>
                );
              })}

              {topicNodes.map((topic) => {
                const isSelected = selectedTopic?.id === topic.id;
                return (
                  <g
                    key={topic.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedTopicId(topic.id)}
                  >
                    <circle
                      cx={topic.x}
                      cy={topic.y}
                      r={isSelected ? topic.radius + 7 : topic.radius}
                      fill="url(#topic-red)"
                      stroke={isSelected ? "#0f172a" : "#fee2e2"}
                      strokeWidth={isSelected ? 5 : 2}
                    />
                    {splitLabel(getShortTitle(topic.title), 6).map(
                      (line, index, lines) => (
                        <text
                          key={line}
                          x={topic.x}
                          y={
                            topic.y +
                            (index - (lines.length - 1) / 2) * 21 -
                            2
                          }
                          textAnchor="middle"
                          className="pointer-events-none fill-white text-[17px] font-black"
                        >
                          {line}
                        </text>
                      )
                    )}
                    <text
                      x={topic.x}
                      y={topic.y + topic.radius - 18}
                      textAnchor="middle"
                      className="pointer-events-none fill-red-50 text-[12px] font-bold"
                    >
                      熱度 {topic.heatScore}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-blue-700">目前選取</div>
          {selectedTopic ? (
            <>
              <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">
                {selectedTopic.title}
              </h2>

              {selectedDetail?.summary && (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {selectedDetail.summary}
                </p>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-2xl bg-red-50 p-3 text-red-700">
                  <div className="text-xs font-medium">熱度</div>
                  <div className="mt-1 font-black">{selectedTopic.heatScore}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-slate-700">
                  <div className="text-xs font-medium">媒體</div>
                  <div className="mt-1 font-black">
                    {selectedTopic.sourceCount}
                  </div>
                </div>
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                  <div className="text-xs font-medium">文章</div>
                  <div className="mt-1 font-black">
                    {selectedTopic.articleCount}
                  </div>
                </div>
              </div>

              {selectedSignals.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-500">
                    子訊號
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedSignals.map((signal) => (
                      <span
                        key={signal.label}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getSignalKindClass(signal.kind)}`}
                      >
                        {signal.label} · {getSignalKindLabel(signal.kind)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedBridges.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-500">
                    共同點
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedBridges.map((bridge) => (
                      <span
                        key={bridge.id}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {bridge.label} · {Math.round(bridge.score)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedDetail?.articles?.length ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-500">
                    快讀來源
                  </div>
                  <div className="mt-2 space-y-2">
                    {selectedDetail.articles.slice(0, 2).map((article) => (
                      <div
                        key={article.id}
                        className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"
                      >
                        {article.quickSummary ||
                          article.description ||
                          article.title}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <Link
                href={`/topics/${selectedTopic.slug}`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                查看主題詳情
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">請點選一個紅色大主題。</p>
          )}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-blue-700">優化觀察</div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
            <p>
              手機版已先改成橫向滑動，避免圖被壓扁；之後可再做手機專用的分層列表。
            </p>
            <p>
              白色共同點已開始使用類別與跨主題共通訊號，但還可以加入更精準的關鍵字共現分數。
            </p>
            <p>
              藍色子訊號已優先抓主題詳情與文章快讀，下一步可把人物、地點、事件分開標示。
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
