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

function sourceLabel(value?: string) {
  if (value === "signal_tables") return "正式 Signal Ledger";
  if (value === "monthly_current") return "當月訊號候選";
  if (value === "derived_topics") return "主題推導預覽";
  return "資料載入中";
}

function stageLabel(signal: SignalRow) {
  if (signal.bestOutcome?.outcome === "success") return "已驗證";
  if (signal.bestOutcome?.outcome === "failed") return "需修正";
  if (signal.signalStrength >= 85) return "高信念";
  if (signal.signalStrength >= 70) return "升溫中";
  return "觀察中";
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
    "相關新聞與來源數是否連續增加",
    "受惠 basket 是否開始跑贏 benchmark",
    "公司財報、法說會或供應鏈消息是否回頭驗證假設",
  ];

  if (lane.includes("Memory")) return ["DRAM / NAND / HBM 報價是否續漲", "Micron、SK Hynix、Samsung 是否上修展望", ...base.slice(1)];
  if (lane.includes("Power")) return ["資料中心電力需求是否擴散到電網、變壓器、UPS", "GEV、ETN、台達電、華城等標的是否同步轉強", ...base.slice(2)];
  if (lane.includes("Cooling")) return ["液冷滲透率與高密度機櫃需求是否增加", "散熱供應鏈訂單與營收是否跟上", ...base.slice(1)];
  if (lane.includes("Packaging")) return ["CoWoS / 先進封裝產能是否持續吃緊", "封測與設備鏈是否出現更多公司行動", ...base.slice(1)];
  return base;
}

function splitWatchlists(watchlists: Watchlist[] = []) {
  return {
    us: watchlists.filter((item) => item.market === "US"),
    tw: watchlists.filter((item) => item.market === "TW"),
    other: watchlists.filter((item) => item.market !== "US" && item.market !== "TW"),
  };
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 85 ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : score >= 70 ? "border-sky-300/30 bg-sky-400/10 text-sky-200" : "border-amber-300/30 bg-amber-400/10 text-amber-200";
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${tone}`}>Strength {score}</span>;
}

export default function SignalsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/signals")
      .then((response) => response.json())
      .then((payload: ApiResponse) => setData(payload))
      .catch((error: Error) => setData({ ok: false, error: error.message, signals: [] }))
      .finally(() => setLoading(false));
  }, []);

  const signals = useMemo(() => data?.signals ?? [], [data?.signals]);
  const sortedSignals = useMemo(
    () => [...signals].sort((a, b) => b.signalStrength - a.signalStrength || b.confidenceScore - a.confidenceScore),
    [signals],
  );
  const researchSignals = useMemo(() => {
    const strong = sortedSignals.filter((signal) => signal.signalStrength >= 70).slice(0, 3);
    return strong.length > 0 ? strong : sortedSignals.slice(0, 1);
  }, [sortedSignals]);
  const watchPool = sortedSignals.filter((signal) => !researchSignals.some((item) => item.id === signal.id));
  const validatedCount = signals.filter((signal) => signal.bestOutcome?.outcome === "success").length;

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_34%),#090b13] p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Signal Research Radar</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">目前最值得追蹤的市場訊號</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
                這頁不再把所有訊號攤開。TrendRadar 只挑出 1-3 個強度夠高、可形成研究假設的候選，並列出你可以追蹤的蛛絲馬跡與台股/美股觀察標的。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <MiniMetric label="研究候選" value={String(researchSignals.length)} />
              <MiniMetric label="觀察池" value={String(watchPool.length)} />
              <MiniMetric label="已驗證" value={String(validatedCount)} />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 font-bold text-zinc-300">
              資料模式：{sourceLabel(data?.source)}
            </span>
            <Link href="/market-map" className="rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 font-bold text-zinc-200 transition hover:border-sky-400/60">
              查看市場地圖
            </Link>
            <Link href="/reports/signal-validation" className="rounded-full bg-white px-4 py-2 font-black text-zinc-950 transition hover:bg-sky-100">
              查看驗證報告
            </Link>
          </div>
        </header>

        {loading ? <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-zinc-400">正在讀取市場訊號...</div> : null}
        {!loading && data?.error ? <div className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-200">{data.error}</div> : null}

        <section className="space-y-5">
          {researchSignals.map((signal, index) => (
            <ResearchSignalCard key={signal.id} signal={signal} rank={index + 1} />
          ))}
        </section>

        {!loading && researchSignals.length === 0 ? (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-12 text-center">
            <p className="text-lg font-black text-white">目前還沒有足夠強的市場訊號。</p>
            <p className="mt-2 text-sm text-zinc-500">等新聞、供應鏈或價格資料進來後，TrendRadar 會只挑出值得研究的候選，而不是硬湊列表。</p>
          </section>
        ) : null}

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Observation Pool</p>
              <h2 className="mt-2 text-2xl font-black">其他訊號先放觀察池</h2>
            </div>
            <p className="text-sm text-zinc-600">不夠強就不推成研究主題，避免使用者被雜訊帶著跑。</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {watchPool.slice(0, 6).map((signal) => (
              <Link key={signal.id} href={`/signals/${signal.id}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-zinc-600">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="line-clamp-1 font-black text-white">{signal.topic}</p>
                    <p className="mt-1 text-xs text-zinc-600">{signalTypeLabel(signal.signalType)} · {inferResearchLane(signal)}</p>
                  </div>
                  <span className="font-mono text-sm font-black text-zinc-400">{signal.signalStrength}</span>
                </div>
              </Link>
            ))}
            {watchPool.length === 0 ? <p className="rounded-2xl bg-zinc-900/60 p-4 text-sm text-zinc-600">目前沒有其他觀察訊號。</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function ResearchSignalCard({ signal, rank }: { signal: SignalRow; rank: number }) {
  const watchlists = signal.watchlists ?? [];
  const { us, tw, other } = splitWatchlists(watchlists);
  const clues = trackingClues(signal);
  const best = signal.bestOutcome;
  const isMonthlyCandidate = signal.id.startsWith("monthly-");

  return (
    <article className="rounded-[2rem] border border-zinc-800 bg-zinc-950/90 p-6 shadow-2xl shadow-black/20 md:p-8">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-zinc-950">#{rank}</span>
            <ScoreBadge score={signal.signalStrength} />
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-300">{stageLabel(signal)}</span>
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-300">{inferResearchLane(signal)}</span>
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">{signal.topic}</h2>
          <p className="mt-3 text-sm text-zinc-500">
            Signal created {signal.signalDate} · {signalTypeLabel(signal.signalType)} · confidence {signal.confidenceScore}
          </p>

          <div className="mt-6 rounded-3xl border border-sky-400/20 bg-sky-400/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-200">你從這個訊號得到什麼</p>
            <p className="mt-3 text-lg font-black leading-8 text-white">{signal.hypothesis}</p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MiniMetric label="Basket Return" value={best ? formatPct(best.basket_return) : "待驗證"} />
            <MiniMetric label="Benchmark" value={best ? formatPct(best.benchmark_return) : "待驗證"} />
            <MiniMetric label="Alpha" value={best ? formatPct(best.excess_return) : "待驗證"} tone="text-emerald-300" />
          </div>

          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">接下來追蹤的蹤跡</p>
            <div className="mt-3 grid gap-2">
              {clues.map((clue) => (
                <div key={clue} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-bold text-zinc-300">
                  {clue}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="rounded-3xl border border-zinc-800 bg-black/20 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Investment Basket</p>
              <h3 className="mt-2 text-xl font-black">需關注標的</h3>
            </div>
            {isMonthlyCandidate ? (
              <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-xs font-black text-sky-200">
                月度候選
              </span>
            ) : (
              <Link href={`/signals/${signal.id}`} className="rounded-full bg-white px-4 py-2 text-xs font-black text-zinc-950 transition hover:bg-sky-100">
                研究詳情
              </Link>
            )}
          </div>

          <BasketSection title="美股" items={us} />
          <BasketSection title="台股" items={tw} />
          {other.length > 0 ? <BasketSection title="其他市場" items={other} /> : null}

          {watchlists.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100/80">
              這個 signal 尚未產生正式 beneficiary basket。它可以先當研究候選，但還不能回測。
            </div>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

function BasketSection({ title, items }: { title: string; items: Watchlist[] }) {
  return (
    <section className="mt-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-zinc-300">{title}</p>
        <p className="text-xs text-zinc-600">{items.length} 檔</p>
      </div>
      <div className="mt-2 space-y-2">
        {items.slice(0, 6).map((item) => (
          <div key={`${item.market}-${item.symbol}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-1 font-black text-white">{item.companyName || item.symbol}</p>
                <p className="mt-1 text-xs text-zinc-500">{marketLabel(item.market)} · {item.symbol}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-black text-sky-300">{formatPrice(item)}</p>
                <p className="mt-1 text-xs text-zinc-600">資料庫最新價</p>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 ? <p className="rounded-2xl bg-zinc-900/50 p-3 text-sm text-zinc-600">目前沒有{title}標的。</p> : null}
      </div>
    </section>
  );
}

function MiniMetric({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={`mt-2 font-mono text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}
