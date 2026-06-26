"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Outcome = {
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: string;
};

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
  } | null;
};

type SignalRow = {
  id: string;
  signalDate: string;
  asOfDate: string;
  topic: string;
  signalType: string;
  signalStrength: number;
  confidenceScore: number;
  hypothesis: string;
  status: string;
  watchlistCount: number;
  watchlists?: Watchlist[];
  bestOutcome: Outcome | null;
};

type ApiResponse = {
  ok: boolean;
  source?: string;
  error?: string;
  signals: SignalRow[];
};

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined) return "待驗證";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function formatPrice(item: Watchlist) {
  if (!item.latestPrice) return "待補價格";
  const close = Number(item.latestPrice.adjClose ?? item.latestPrice.close);
  return `${close.toFixed(2)} · ${item.latestPrice.priceDate}`;
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

function marketLabel(value: string) {
  const labels: Record<string, string> = {
    US: "美股",
    TW: "台股",
    KR: "韓股",
    JP: "日股",
    GLOBAL: "全球",
  };
  return labels[value] ?? value;
}

function inferResearchLane(signal: SignalRow) {
  const text = `${signal.topic} ${signal.hypothesis}`.toLowerCase();
  if (/memory|dram|nand|hbm|micron|hynix|samsung|記憶體/.test(text)) return "Memory / HBM";
  if (/power|grid|transformer|electric|vernova|eaton|電力|電網/.test(text)) return "Power / Grid";
  if (/cool|thermal|liquid|散熱|液冷/.test(text)) return "Cooling";
  if (/packag|cowos|advanced packaging|封裝/.test(text)) return "Packaging";
  if (/network|switch|ethernet|optical|網通/.test(text)) return "Networking";
  return "AI Infrastructure";
}

function trackingClues(signal: SignalRow) {
  const lane = inferResearchLane(signal);
  const base = [
    "來源數與提及量是否連續增加",
    "受惠 basket 是否開始跑贏 benchmark",
    "公司財報、法說會或供應鏈消息是否回頭驗證假設",
  ];

  if (lane.includes("Memory")) {
    return ["DRAM / NAND / HBM 報價是否續漲", "Micron、SK Hynix、Samsung 是否上修展望", ...base.slice(1)];
  }
  if (lane.includes("Power")) {
    return ["資料中心電力需求是否擴散到電網、變壓器、UPS", "GEV、ETN、台達電、華城等標的是否同步轉強", ...base.slice(2)];
  }
  if (lane.includes("Cooling")) {
    return ["液冷滲透率與高密度機櫃需求是否增加", "散熱供應鏈訂單與營收是否跟上", ...base.slice(1)];
  }
  if (lane.includes("Packaging")) {
    return ["CoWoS / 先進封裝產能是否持續吃緊", "封測與設備鏈是否出現更多公司行動", ...base.slice(1)];
  }
  return base;
}

function stageLabel(signal: SignalRow) {
  if (signal.bestOutcome?.outcome === "success") return "已驗證";
  if (signal.bestOutcome?.outcome === "failed") return "需修正";
  if (signal.signalStrength >= 85) return "高信念";
  if (signal.signalStrength >= 70) return "升溫中";
  return "觀察中";
}

function ScorePill({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

export function HomeHeroSignal() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/signals")
      .then((response) => response.json())
      .then((payload: ApiResponse) => setData(payload))
      .catch((error: Error) => setData({ ok: false, error: error.message, signals: [] }))
      .finally(() => setLoading(false));
  }, []);

  const heroSignal = useMemo(() => {
    const signals = data?.signals ?? [];
    return [...signals].sort((a, b) => b.signalStrength - a.signalStrength || b.confidenceScore - a.confidenceScore)[0] ?? null;
  }, [data?.signals]);

  const watchlists = heroSignal?.watchlists ?? [];
  const primaryWatchlists = watchlists.slice(0, 6);
  const clues = heroSignal ? trackingClues(heroSignal).slice(0, 4) : [];
  const isDerivedPreview = data?.source === "derived_topics";

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_34%),#090b13] p-6 md:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Highest Conviction</p>
        <div className="mt-6 h-44 animate-pulse rounded-3xl bg-white/5" />
      </section>
    );
  }

  if (!heroSignal) {
    return (
      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-8 md:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-500">Highest Conviction</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">目前還沒有足夠強的市場訊號。</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-zinc-400">
          TrendRadar 會等資料、證據與觀察名單足夠後，才把主題推成研究候選。這比硬湊熱門新聞更接近可驗證研究。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.25),_transparent_34%),#090b13] p-6 shadow-2xl shadow-sky-950/30 md:p-10">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-zinc-950">目前最高信念研究候選</span>
            <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-black text-sky-200">
              Strength {heroSignal.signalStrength}
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-300">{stageLabel(heroSignal)}</span>
          </div>

          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">{heroSignal.topic}</h1>
          <p className="mt-4 text-sm font-bold text-zinc-500">
            TrendRadar detected {heroSignal.signalDate} · {signalTypeLabel(heroSignal.signalType)} · {inferResearchLane(heroSignal)}
          </p>

          <div className="mt-6 rounded-3xl border border-sky-300/20 bg-sky-400/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-200">Why this matters</p>
            <p className="mt-3 text-lg font-black leading-8 text-white">{heroSignal.hypothesis}</p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <ScorePill label="Confidence" value={String(heroSignal.confidenceScore)} />
            <ScorePill label="30D Basket" value={formatPct(heroSignal.bestOutcome?.basket_return)} />
            <ScorePill label="30D Alpha" value={formatPct(heroSignal.bestOutcome?.excess_return)} tone="text-emerald-300" />
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={`/signals/${heroSignal.id}`} className="rounded-full bg-white px-6 py-3 text-sm font-black text-zinc-950 transition hover:bg-sky-100">
              Read Full Thesis
            </Link>
            <Link href="/signals" className="rounded-full border border-zinc-700 bg-zinc-950 px-6 py-3 text-sm font-bold text-zinc-200 transition hover:border-sky-400/60">
              查看 Research Radar
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Evidence Chain</p>
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-300">
                {isDerivedPreview ? "主題推導中" : "Signal Ledger"}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {clues.map((clue, index) => (
                <div key={clue} className="flex gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-300 text-xs font-black text-zinc-950">{index + 1}</span>
                  <p className="text-sm font-bold leading-6 text-zinc-200">{clue}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Investment Basket</p>
            <div className="mt-4 space-y-3">
              {primaryWatchlists.length > 0 ? (
                primaryWatchlists.map((item) => (
                  <div key={`${item.symbol}-${item.market}`} className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                    <div>
                      <p className="font-black text-white">{item.symbol}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {item.companyName} · {marketLabel(item.market)}
                      </p>
                    </div>
                    <p className="text-right text-xs font-bold text-zinc-400">
                      {formatPrice(item)}
                      <br />
                      <span className="text-zinc-600">資料庫最新價</span>
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-100/90">
                  這仍是主題推導候選，尚未建立正式 investment basket。下一步會補受惠公司映射與可信價格來源。
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
