"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Watchlist = {
  symbol: string;
  companyName: string;
  market: string;
  thesis: string;
  weight: number;
  source: string | null;
  latestPrice: {
    priceDate: string;
    close: number;
    adjClose: number | null;
    volume: number | null;
    qualityStatus?: string | null;
    provider?: string | null;
    sourceUrl?: string | null;
  } | null;
  priceQuality?: {
    status: "verified" | "needs_review";
    reason?: string;
  };
};

type Outcome = {
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: string;
};

type StockDetail = {
  symbol: string;
  companyName: string;
  market: string;
  entryPrice: number | null;
  entryDate: string | null;
  exitPrice: number | null;
  exitDate: string | null;
  returnPct: number | null;
};

type EvidenceItem = {
  id: string;
  signalEventId: string;
  evidenceDate?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceType: string;
  title: string;
  summary?: string;
  whyItMatters?: string;
  knownAtSignalTime: boolean;
};

type TimelineEvent = {
  id: string;
  signalEventId: string;
  eventDate?: string;
  eventType: string;
  title: string;
  description?: string;
  sourceUrl?: string;
  knownAtSignalTime: boolean;
  displayOrder: number;
};

type Lesson = {
  id: string;
  signalEventId: string;
  lessonType: string;
  title: string;
  description?: string;
  impact?: string;
};

type ScoreComponent = {
  componentName: string;
  rawValue: number;
  normalizedScore: number;
  weight: number;
  contribution: number;
  calculationVersion: string;
  inputSnapshot: Record<string, unknown>;
  calculatedAt: string;
};

type ApiResponse = {
  ok: boolean;
  source?: string;
  error?: string;
  signal?: {
    id: string;
    signalDate: string;
    asOfDate: string;
    topic: string;
    signalType: string;
    signalStrength: number;
    confidenceScore: number;
    hypothesis: string;
    evidence: unknown[];
    status: string;
  };
  watchlists?: Watchlist[];
  outcomes?: Outcome[];
  stockReturnDetails?: Array<{ horizonDays: number; details: StockDetail[]; basketReturn: number | null }>;
  evidenceItems?: EvidenceItem[];
  timelineEvents?: TimelineEvent[];
  lessons?: Lesson[];
  scoreComponents?: ScoreComponent[];
};

type EvidenceMetric = {
  topic_id?: string;
  slug?: string | null;
  source?: string;
  category?: string;
  discovery_mode?: string;
  heat_score?: number;
  source_count?: number;
  article_count?: number;
};

function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function price(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(2);
}

function latestPrice(item: Watchlist) {
  if (!item.latestPrice || item.priceQuality?.status !== "verified") return "待補可靠價格";
  const value = Number(item.latestPrice.adjClose ?? item.latestPrice.close);
  return `${value.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} · ${item.latestPrice.priceDate}`;
}

function signalTypeLabel(value: string) {
  const labels: Record<string, string> = {
    news: "新聞訊號",
    price: "價格訊號",
    supply_chain: "供應鏈訊號",
    company_action: "企業行動",
    mixed: "混合訊號",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function signalStage(signal: NonNullable<ApiResponse["signal"]>, outcomes: Outcome[]) {
  if (outcomes.some((item) => item.outcome === "success")) return "已驗證";
  if (outcomes.some((item) => item.outcome === "failed")) return "需修正";
  if (signal.status === "validated") return "已確認";
  if (signal.signalStrength >= 85 && signal.confidenceScore >= 75) return "成長中";
  if (signal.signalStrength >= 65) return "形成中";
  return "早期觀察";
}

function confidenceLabel(score: number) {
  if (score >= 80) return "高";
  if (score >= 60) return "中";
  return "低";
}

function evidenceQuality(evidence: EvidenceMetric, items: EvidenceItem[]) {
  const sources = Number(evidence.source_count ?? 0);
  const primaryEvidence = items.filter((item) => ["official", "company_action", "supply_chain", "price"].includes(item.sourceType)).length;
  if (sources >= 4 && primaryEvidence >= 1) return "高";
  if (sources >= 2 || items.length >= 2) return "中";
  return "待補強";
}

function validationLabel(outcomes: Outcome[]) {
  const completed = outcomes.filter((item) => item.outcome !== "pending");
  if (completed.length === 0) return "尚未驗證";
  if (completed.some((item) => item.outcome === "success")) return "已有正向結果";
  if (completed.some((item) => item.outcome === "partial")) return "部分成立";
  return "驗證未通過";
}

function outcomeLabel(value: string) {
  const labels: Record<string, string> = {
    success: "成立",
    partial: "部分成立",
    failed: "未通過",
    pending: "等待驗證",
  };
  return labels[value] ?? value;
}

function componentLabel(value: string) {
  const labels: Record<string, string> = {
    mentionSpike: "討論增速",
    priceSpike: "價格異常",
    sourceDiversity: "來源多樣性",
    persistence: "持續性",
    companyActivity: "公司行動",
    beneficiaryClarity: "受惠標的清晰度",
  };
  return labels[value] ?? value;
}

function researchLane(signal: NonNullable<ApiResponse["signal"]>) {
  const text = `${signal.topic} ${signal.hypothesis}`.toLowerCase();
  if (/memory|dram|nand|hbm|記憶體/.test(text)) return "memory";
  if (/power|grid|transformer|electric|電力|電網/.test(text)) return "power";
  if (/cool|thermal|liquid|散熱|液冷/.test(text)) return "cooling";
  if (/packag|cowos|封裝/.test(text)) return "packaging";
  if (/network|switch|ethernet|optical|網通|光通訊/.test(text)) return "networking";
  return "general";
}

function whyItMatters(signal: NonNullable<ApiResponse["signal"]>) {
  const lane = researchLane(signal);
  if (lane === "memory") return "記憶體供需通常先反映在報價、產能配置與業者展望，可能比財報更早揭露產業循環變化。";
  if (lane === "power") return "若 AI 建設瓶頸由算力轉向供電，需求可能擴散到發電、電網、變壓器、UPS 與電力管理設備。";
  if (lane === "cooling") return "高密度伺服器提高單櫃熱負載，可能加快液冷與先進熱管理導入，並改變資料中心設備支出。";
  if (lane === "packaging") return "先進封裝若成為供應瓶頸，產能利用率、設備訂單與擴產行動可能率先發生變化。";
  if (lane === "networking") return "算力擴張必須同步提升資料傳輸效率，交換器、光通訊與高速網路可能成為下一個瓶頸。";
  return "當多個獨立來源、公司行動與市場資料朝同一方向變化時，可能代表產業趨勢正在形成，而不只是短期新聞熱度。";
}

function trackingChecklist(signal: NonNullable<ApiResponse["signal"]>) {
  const lane = researchLane(signal);
  if (lane === "memory") return ["DRAM、NAND、HBM 報價與庫存變化", "主要業者產能分配、展望與資本支出", "觀察籃子是否持續跑贏半導體基準"];
  if (lane === "power") return ["資料中心用電需求是否延伸至電網與變壓器", "設備業者在手訂單、交期與展望", "觀察籃子是否持續跑贏市場基準"];
  if (lane === "cooling") return ["液冷滲透率與高密度機櫃需求", "散熱供應鏈訂單是否轉化為營收", "客戶建置進度與資本支出"];
  if (lane === "packaging") return ["先進封裝產能利用率與交期", "封測及設備業者訂單與擴產", "主要客戶 AI 晶片出貨節奏"];
  return ["獨立來源是否持續增加", "公司公告或財報是否支持假設", "觀察籃子相對 benchmark 的表現"];
}

function invalidationChecklist(signal: NonNullable<ApiResponse["signal"]>) {
  const lane = researchLane(signal);
  if (lane === "memory") return ["報價轉跌且庫存重新上升", "主要業者下修需求或產能利用率"];
  if (lane === "power") return ["資料中心建置延期，設備交期開始縮短", "電力設備業者下修在手訂單或展望"];
  if (lane === "cooling") return ["液冷導入低於預期，訂單未轉化為營收", "高密度機櫃需求或客戶建置放緩"];
  if (lane === "packaging") return ["先進封裝利用率下滑或擴產延後", "設備訂單沒有跟上產能擴張敘事"];
  return ["證據來源停止增加或出現相反公司資訊", "觀察籃子持續落後 benchmark，基本面也未驗證"];
}

function scoreColor(score: number) {
  if (score >= 75) return "#10b981";
  if (score >= 45) return "#38bdf8";
  return "#f59e0b";
}

function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const stroke = 5;
  const radius = size / 2 - stroke - 2;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, score));

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#27272a" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={scoreColor(score)}
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
        />
      </svg>
      <div className="z-10 text-center">
        <div className="font-mono text-2xl font-black text-white">{score}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">score</div>
      </div>
    </div>
  );
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildResearchReadiness(signal: NonNullable<ApiResponse["signal"]>, evidence: EvidenceMetric, evidenceItemCount: number, watchlistCount: number, outcomeCount: number) {
  const sources = evidence.source_count ?? 0;
  const articles = evidence.article_count ?? 0;

  return [
    { label: "新聞與主題資料", value: clampScore(Math.min(articles * 12, 100)), note: articles > 0 ? `${articles} 篇代表文章` : "尚無文章數" },
    { label: "來源多樣性", value: clampScore(Math.min(sources * 20, 100)), note: sources > 0 ? `${sources} 個來源` : "尚無來源數" },
    { label: "證據鏈", value: clampScore(Math.min(evidenceItemCount * 25, 100)), note: evidenceItemCount > 0 ? `${evidenceItemCount} 筆證據` : "待建立" },
    { label: "標的映射", value: clampScore(Math.min(watchlistCount * 18, 100)), note: watchlistCount > 0 ? `${watchlistCount} 檔標的` : "待建立" },
    { label: "前瞻驗證", value: clampScore(Math.min(outcomeCount * 25, 100)), note: outcomeCount > 0 ? `${outcomeCount} 個期間` : "待回測" },
    { label: "研究信心", value: signal.confidenceScore, note: `${confidenceLabel(signal.confidenceScore)}信心` },
  ];
}

function buildTimeline(signal: NonNullable<ApiResponse["signal"]>, watchlistCount: number, outcomeCount: number) {
  return [
    { label: signal.signalDate, title: "偵測到訊號", body: `TrendRadar 僅使用 ${signal.asOfDate} 以前可取得的資訊形成這個候選訊號。`, state: "done" },
    { label: "證據", title: "建立初步證據", body: "整理主題熱度、來源多樣性與當時可取得的市場脈絡。", state: "done" },
    { label: "標的", title: "建立觀察籃子", body: watchlistCount > 0 ? `已映射 ${watchlistCount} 檔相關標的，等待後續驗證。` : "尚未建立受惠標的觀察籃子。", state: watchlistCount > 0 ? "done" : "pending" },
    { label: "7/14/30/60D", title: "前瞻回測", body: outcomeCount > 0 ? `目前共有 ${outcomeCount} 個驗證期間。` : "股價資料完整後，才會驗證訊號日之後的報酬。", state: outcomeCount > 0 ? "done" : "pending" },
    { label: "驗證", title: "研究復盤", body: outcomeCount > 0 ? "將觀察籃子與 benchmark 比較，判斷訊號是否產生超額報酬。" : "等待觀察籃子與 benchmark 資料完整。", state: outcomeCount > 0 ? "done" : "pending" },
  ];
}

function timelineDate(value: string | undefined, fallback: string) {
  return value ?? fallback;
}

function safeExternalUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function SignalDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/signals/${params.id}`)
      .then((response) => response.json())
      .then((payload: ApiResponse) => setData(payload))
      .catch((error: Error) => setData({ ok: false, error: error.message }))
      .finally(() => setLoading(false));
  }, [params.id]);

  const returnRows = useMemo(() => {
    const bySymbol = new Map<string, { symbol: string; companyName: string; market: string; entryPrice: number | null; returns: Record<number, number | null> }>();
    for (const horizon of data?.stockReturnDetails ?? []) {
      for (const detail of horizon.details) {
        const row = bySymbol.get(detail.symbol) ?? {
          symbol: detail.symbol,
          companyName: detail.companyName,
          market: detail.market,
          entryPrice: detail.entryPrice,
          returns: {},
        };
        row.returns[horizon.horizonDays] = detail.returnPct;
        bySymbol.set(detail.symbol, row);
      }
    }
    return [...bySymbol.values()];
  }, [data?.stockReturnDetails]);

  const evidence = (data?.signal?.evidence?.[0] ?? {}) as EvidenceMetric;
  const outcomes = data?.outcomes ?? [];
  const watchlists = data?.watchlists ?? [];
  const evidenceItems = data?.evidenceItems ?? [];
  const lessons = data?.lessons ?? [];
  const scoreComponents = data?.scoreComponents ?? [];

  if (loading) {
    return <main className="min-h-screen bg-[#05070d] px-6 py-10 text-zinc-400">正在整理研究報告...</main>;
  }

  if (!data?.ok || !data.signal) {
    return <main className="min-h-screen bg-[#05070d] px-6 py-10 text-amber-200">{data?.error ?? "找不到這個訊號"}</main>;
  }

  const completedOutcomes = outcomes.filter((item) => item.outcome !== "pending");
  const researchReadiness = buildResearchReadiness(data.signal, evidence, evidenceItems.length, watchlists.length, completedOutcomes.length);
  const stage = signalStage(data.signal, outcomes);
  const evidenceLevel = evidenceQuality(evidence, evidenceItems);
  const fallbackTimeline = buildTimeline(data.signal, watchlists.length, outcomes.length);
  const timeline =
    (data.timelineEvents ?? []).length > 0
      ? (data.timelineEvents ?? []).map((item) => ({
          label: timelineDate(item.eventDate, item.eventType),
          title: item.title,
          body: item.description ?? "",
          state: item.knownAtSignalTime ? "done" : "pending",
        }))
      : fallbackTimeline;

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/signals" className="text-sm font-bold text-sky-300 hover:text-sky-200">← 返回市場訊號</Link>

        <section className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_34%),#090b13] p-6 shadow-2xl shadow-sky-950/30 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <ScoreRing score={data.signal.signalStrength} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-200">{signalTypeLabel(data.signal.signalType)}</span>
                <span className="rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-1 text-xs font-bold text-zinc-300">資料截止 {data.signal.asOfDate}</span>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">{stage}</span>
                <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">{data.source === "derived_topics" ? "候選研究" : "正式紀錄"}</span>
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{data.signal.topic}</h1>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.22em] text-sky-300">研究結論</p>
              <p className="mt-3 max-w-4xl text-base leading-8 text-zinc-200">{data.signal.hypothesis}</p>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">為什麼值得注意</p>
                <p className="mt-2 text-sm font-bold leading-7 text-white">{whyItMatters(data.signal)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="訊號強度" value={`${data.signal.signalStrength}/100`} tone="text-sky-300" />
          <MetricCard label="研究信心" value={`${confidenceLabel(data.signal.confidenceScore)} · ${data.signal.confidenceScore}`} tone="text-emerald-300" />
          <MetricCard label="證據品質" value={evidenceLevel} tone="text-amber-300" />
          <MetricCard label="驗證狀態" value={validationLabel(outcomes)} tone="text-zinc-100" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">{scoreComponents.length > 0 ? "Signal Score Components" : "Research Readiness"}</p>
            <h2 className="mt-2 text-2xl font-black">{scoreComponents.length > 0 ? "訊號分數從哪裡來？" : "這份研究目前完整到哪裡？"}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              {scoreComponents.length > 0
                ? "每一項都保存原始值、正規化分數、權重與實際貢獻，報告不再由前端猜測分數組成。"
                : "這裡只顯示研究資料的完成程度，不是假裝成模型的精確分數拆解。缺少原始資料的項目會明確標示待補。"}
            </p>
            <div className="mt-5 space-y-4">
              {(scoreComponents.length > 0
                ? scoreComponents.map((item) => ({
                    label: componentLabel(item.componentName),
                    value: item.normalizedScore,
                    note: `權重 ${(item.weight * 100).toFixed(0)}% · 貢獻 ${item.contribution.toFixed(2)}`,
                  }))
                : researchReadiness
              ).map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-bold text-zinc-300">{item.label}</span>
                    <span className="font-mono text-xs text-zinc-500">{item.note} · {item.value}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-300" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Signal Timeline</p>
            <h2 className="mt-2 text-2xl font-black">從發現到驗證</h2>
            <div className="mt-6 space-y-4">
              {timeline.map((item, index) => (
                <div key={`${item.label}-${item.title}`} className="relative grid grid-cols-[82px_1fr] gap-4">
                  {index < timeline.length - 1 ? <div className="absolute left-[40px] top-8 h-full w-px bg-zinc-800" /> : null}
                  <div className="relative z-10 flex h-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 font-mono text-[11px] font-bold text-zinc-400">
                    {item.label}
                  </div>
                  <div className={`rounded-2xl border p-4 ${item.state === "done" ? "border-sky-300/20 bg-sky-400/10" : "border-zinc-800 bg-zinc-900/60"}`}>
                    <p className="font-black text-white">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Investment Thesis</p>
            <h2 className="mt-3 text-2xl font-black">投資研究假設</h2>
            <p className="mt-4 leading-8 text-zinc-300">{data.signal.hypothesis}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <SmallFact label="研究階段" value={stage} />
              <SmallFact label="發現方式" value={evidence.discovery_mode ?? data.signal.status} />
              <SmallFact label="資料模式" value={data.source === "derived_topics" ? "主題推導候選" : "正式 Signal Ledger"} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Checklist title="接下來要驗證什麼" items={trackingChecklist(data.signal)} tone="emerald" />
              <Checklist title="什麼情況代表判斷可能錯了" items={invalidationChecklist(data.signal)} tone="rose" />
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Evidence Chain</p>
            <h2 className="mt-2 text-2xl font-black">證據鏈</h2>
            {evidenceItems.length > 0 ? (
              <div className="mt-5 space-y-3">
                {evidenceItems.map((item) => {
                  const sourceUrl = safeExternalUrl(item.sourceUrl);
                  return (
                    <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-bold text-zinc-500">{item.sourceType}</span>
                      <span className="text-xs font-mono text-zinc-600">{item.evidenceDate ?? "undated"}</span>
                      {item.sourceName ? <span className="text-xs font-bold text-zinc-500">{item.sourceName}</span> : null}
                    </div>
                    <p className="mt-3 font-black text-white">{item.title}</p>
                    {item.summary ? <p className="mt-2 text-sm leading-6 text-zinc-500">{item.summary}</p> : null}
                    {item.whyItMatters ? <p className="mt-2 text-sm leading-6 text-sky-300">{item.whyItMatters}</p> : null}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-bold text-zinc-600">{item.knownAtSignalTime ? "✓ 訊號形成當時已知" : "後續驗證資料"}</p>
                      {sourceUrl ? (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-black text-sky-300 hover:text-sky-200"
                        >
                          查看原始資料 ↗
                        </a>
                      ) : null}
                    </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <EvidenceRow label="Source mode" value={evidence.source ?? data.source ?? "signal"} />
                <EvidenceRow label="Topic id" value={String(evidence.topic_id ?? data.signal.id)} />
                <EvidenceRow label="Slug" value={String(evidence.slug ?? "-")} />
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Beneficiary Watchlist</p>
                <h2 className="mt-2 text-2xl font-black">為什麼要觀察這些標的？</h2>
              </div>
              <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-400">{watchlists.length} names</span>
            </div>
            <div className="mt-5 space-y-3">
              {watchlists.map((item) => (
                <div key={`${item.symbol}-${item.market}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-lg font-black text-white">{item.symbol}</div>
                    <div className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-200">{item.market}</div>
                  </div>
                  <p className="mt-1 text-sm font-bold text-zinc-300">{item.companyName}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-zinc-950 px-3 py-1.5 font-mono font-bold text-white">
                      最新收盤 {latestPrice(item)}
                    </span>
                    <span className={item.priceQuality?.status === "verified"
                      ? "rounded-full bg-emerald-400/10 px-3 py-1.5 font-bold text-emerald-200"
                      : "rounded-full bg-amber-400/10 px-3 py-1.5 font-bold text-amber-200"}>
                      {item.priceQuality?.status === "verified" ? "官方資料已驗證" : "價格待驗證"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">{item.thesis}</p>
                </div>
              ))}
              {watchlists.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-5 text-sm leading-7 text-zinc-500">
                  Watchlist 尚未正式生成。這通常代表目前使用 topic-derived fallback；等 signal_events 正式寫入後，beneficiary mapping 會把相關公司接上來。
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Validation Windows</p>
            <h2 className="mt-2 text-2xl font-black">後續表現驗證</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {outcomes.map((outcome) => (
                <div key={outcome.horizon_days} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <p className="text-sm font-bold text-zinc-500">{outcome.horizon_days}D</p>
                  <p className="mt-2 text-2xl font-black text-white">{outcomeLabel(outcome.outcome)}</p>
                  <p className="mt-3 text-sm text-zinc-500">觀察籃子 <span className="font-mono text-zinc-200">{pct(outcome.basket_return)}</span></p>
                  <p className="text-sm text-zinc-500">比較基準 <span className="font-mono text-zinc-200">{pct(outcome.benchmark_return)}</span></p>
                  <p className="text-sm text-zinc-500">超額報酬 <span className="font-mono text-sky-300">{pct(outcome.excess_return)}</span></p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/90">
          <div className="border-b border-zinc-800 px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Return Table</p>
            <h2 className="mt-2 text-2xl font-black">個別標的驗證</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="bg-zinc-900/80 text-zinc-500">
                <tr>
                  <th className="px-6 py-4">代號</th>
                  <th className="px-6 py-4">公司</th>
                  <th className="px-6 py-4">訊號日價格</th>
                  <th className="px-6 py-4">7D</th>
                  <th className="px-6 py-4">14D</th>
                  <th className="px-6 py-4">30D</th>
                  <th className="px-6 py-4">60D</th>
                </tr>
              </thead>
              <tbody>
                {returnRows.map((row) => (
                  <tr key={row.symbol} className="border-t border-zinc-900">
                    <td className="px-6 py-4 font-mono font-black text-white">{row.symbol}</td>
                    <td className="px-6 py-4 text-zinc-300">{row.companyName}</td>
                    <td className="px-6 py-4 font-mono text-zinc-400">{price(row.entryPrice)}</td>
                    <td className="px-6 py-4 font-mono text-zinc-400">{pct(row.returns[7])}</td>
                    <td className="px-6 py-4 font-mono text-zinc-400">{pct(row.returns[14])}</td>
                    <td className="px-6 py-4 font-mono text-zinc-400">{pct(row.returns[30])}</td>
                    <td className="px-6 py-4 font-mono text-zinc-400">{pct(row.returns[60])}</td>
                  </tr>
                ))}
                {returnRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-zinc-600">目前缺少可驗證的股價資料，暫不顯示報酬結果。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Lessons Learned</p>
          <h2 className="mt-2 text-2xl font-black">研究流程學到了什麼？</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {lessons.map((lesson) => (
              <div key={lesson.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-bold text-zinc-500">{lesson.lessonType.replaceAll("_", " ")}</span>
                <p className="mt-3 font-black text-white">{lesson.title}</p>
                {lesson.description ? <p className="mt-2 text-sm leading-6 text-zinc-500">{lesson.description}</p> : null}
                {lesson.impact ? <p className="mt-2 text-sm leading-6 text-amber-200">{lesson.impact}</p> : null}
              </div>
            ))}
            {lessons.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-5 text-sm leading-7 text-zinc-500">
                完成至少一個驗證期間或研究復盤後，這裡才會記錄成功原因、失敗原因與模型修正。
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="mt-2 truncate text-sm font-bold text-zinc-200">{value}</p>
    </div>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="mt-2 break-all font-mono text-xs text-zinc-300">{value}</p>
    </div>
  );
}

function Checklist({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "rose" }) {
  const styles =
    tone === "emerald"
      ? "border-emerald-300/15 bg-emerald-400/5 text-emerald-100"
      : "border-rose-300/15 bg-rose-400/5 text-rose-100";

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className={`rounded-2xl border px-4 py-3 text-sm font-bold leading-6 ${styles}`}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
