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

type SignalRow = {
  id: string;
  signalDate: string;
  topic: string;
  signalType: string;
  signalStrength: number;
  confidenceScore: number;
  hypothesis: string;
  watchlistCount: number;
  bestOutcome: Outcome | null;
};

type ApiResponse = {
  ok: boolean;
  source?: string;
  error?: string;
  signals: SignalRow[];
};

const clusters = [
  {
    key: "Compute",
    label: "算力",
    description: "GPU、ASIC、AI accelerator、伺服器與雲端算力需求。",
    pattern: /compute|gpu|accelerator|asic|server|nvidia|amd|broadcom|算力|伺服器/i,
    color: "from-blue-400 to-sky-500",
  },
  {
    key: "Memory",
    label: "記憶體",
    description: "HBM、DRAM、NAND、記憶體價格與產能轉移。",
    pattern: /memory|dram|nand|hbm|micron|hynix|samsung|記憶體|南亞科|華邦電|群聯/i,
    color: "from-violet-400 to-purple-500",
  },
  {
    key: "Packaging",
    label: "先進封裝",
    description: "CoWoS、先進封裝、測試、設備與封測產能瓶頸。",
    pattern: /packag|cowos|advanced packaging|tsmc|amkor|ase|封裝|台積電|日月光|弘塑|萬潤|辛耘/i,
    color: "from-emerald-400 to-green-500",
  },
  {
    key: "Cooling",
    label: "散熱",
    description: "液冷、熱管理、高密度機櫃與資料中心散熱。",
    pattern: /cool|thermal|liquid|vertiv|heat|散熱|液冷|奇鋐|雙鴻/i,
    color: "from-cyan-300 to-teal-500",
  },
  {
    key: "Power",
    label: "電力",
    description: "發電、電網、變壓器、UPS 與資料中心供電。",
    pattern: /power|grid|transformer|electric|vernova|eaton|abb|電力|電網|變壓器|台達電|華城|中興電/i,
    color: "from-amber-300 to-orange-500",
  },
  {
    key: "Networking",
    label: "網通",
    description: "交換器、乙太網路、光通訊、資料中心互連。",
    pattern: /network|switch|ethernet|optical|transceiver|網通|交換器|光通訊/i,
    color: "from-pink-400 to-rose-500",
  },
] as const;

function inferCluster(signal: SignalRow) {
  const text = `${signal.topic} ${signal.hypothesis}`;
  return clusters.find((cluster) => cluster.pattern.test(text)) ?? clusters[0];
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return "待驗證";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

export default function MarketMapPage() {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    fetch("/api/signals")
      .then((response) => response.json())
      .then((payload: ApiResponse) => setData(payload))
      .catch((error: Error) => setData({ ok: false, error: error.message, signals: [] }));
  }, []);

  const signals = useMemo(() => data?.signals ?? [], [data?.signals]);
  const grouped = useMemo(() => {
    return clusters.map((cluster) => {
      const clusterSignals = signals.filter((signal) => inferCluster(signal).key === cluster.key);
      const strongest = clusterSignals.reduce<SignalRow | null>(
        (best, signal) => (!best || signal.signalStrength > best.signalStrength ? signal : best),
        null,
      );
      const avgStrength = clusterSignals.length
        ? Math.round(clusterSignals.reduce((sum, signal) => sum + signal.signalStrength, 0) / clusterSignals.length)
        : 0;
      return { ...cluster, signals: clusterSignals, strongest, avgStrength };
    });
  }, [signals]);

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_32%),#090b13] p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Market Map</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">AI 基礎建設市場地圖</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
            這不是產業百科，而是把 Signal Ledger 裡的訊號放回供應鏈位置。目標是快速看出 TrendRadar 目前在哪些環節看到市場變化。
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-zinc-300">來源：{data?.source === "derived_topics" ? "主題推導預覽" : "正式訊號表"}</span>
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-zinc-300">訊號：{signals.length}</span>
            <Link href="/signals" className="rounded-full bg-white px-4 py-2 font-black text-zinc-950 transition hover:bg-sky-100">
              回到 Signal Ledger
            </Link>
          </div>
        </header>

        {data?.error ? <div className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-200">{data.error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {grouped.map((cluster) => (
            <div key={cluster.key} className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${cluster.color}`} />
                  <h2 className="mt-4 text-2xl font-black">{cluster.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{cluster.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-3xl font-black text-white">{cluster.signals.length}</p>
                  <p className="text-xs text-zinc-600">signals</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-zinc-600">
                  <span>平均強度</span>
                  <span>{cluster.avgStrength}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className={`h-full rounded-full bg-gradient-to-r ${cluster.color}`} style={{ width: `${Math.max(4, cluster.avgStrength)}%` }} />
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-zinc-800 pt-4">
                {cluster.signals.slice(0, 3).map((signal) => (
                  <Link key={signal.id} href={`/signals/${signal.id}`} className="block rounded-2xl bg-zinc-900/70 p-3 transition hover:bg-zinc-800">
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-black text-white">{signal.topic}</p>
                      <span className="font-mono text-sm font-black text-sky-300">{signal.signalStrength}</span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-600">30日超額：{pct(signal.bestOutcome?.excess_return)}</p>
                  </Link>
                ))}
                {cluster.signals.length === 0 ? <p className="rounded-2xl bg-zinc-900/60 p-4 text-sm text-zinc-600">目前沒有活躍訊號。</p> : null}
                {cluster.signals.length > 3 ? <p className="text-xs font-bold text-zinc-600">還有 {cluster.signals.length - 3} 個訊號在此分類。</p> : null}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">怎麼使用這張地圖</p>
          <h2 className="mt-2 text-2xl font-black">看分布，不看熱鬧。</h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-400">
            如果某一層連續出現多個訊號，例如 Memory、Power、Cooling 同時升溫，代表 AI infrastructure 的瓶頸可能正在轉移。這張圖的目的不是告訴你買哪一檔，而是幫你知道研究應該往哪裡集中。
          </p>
        </section>
      </div>
    </main>
  );
}
