import Link from "next/link";
import TrendGlobeMap from "@/components/TrendGlobeMap";

export default function TrendGlobePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f3b5f_0,_#020617_42%,_#000_100%)] px-3 py-3 text-white md:px-8 md:py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-slate-400 hover:text-white"
            >
              返回首頁
            </Link>
            <div className="mt-4 text-xs font-black uppercase tracking-[0.26em] text-cyan-300">
              Trend Globe
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">
              把今天的新聞放到同一顆星球上
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
              拖曳旋轉、點紅色主題聚焦。右側會顯示快讀、代表事件與來源，讓探索感保留，但資訊不要擋住地球。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/trend-taiwan"
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
            >
              看台灣航線圖
            </Link>
            <Link
              href="/trend-map"
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
            >
              回主題分子圖
            </Link>
          </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-200/10 bg-white/[0.06] px-4 py-3 text-slate-300">
              <span className="font-black text-rose-200">紅色節點</span> 是熱門大主題
            </div>
            <div className="rounded-2xl border border-cyan-200/10 bg-white/[0.06] px-4 py-3 text-slate-300">
              <span className="font-black text-cyan-200">藍色節點</span> 是主題分支訊號
            </div>
            <div className="rounded-2xl border border-cyan-200/10 bg-white/[0.06] px-4 py-3 text-slate-300">
              <span className="font-black text-white">右側面板</span> 顯示重點與來源
            </div>
          </div>
        </div>

        <TrendGlobeMap />
      </div>
    </main>
  );
}
