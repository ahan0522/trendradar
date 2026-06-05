import Link from "next/link";
import TaiwanRoutesMap from "@/components/TaiwanRoutesMap";

export default function TrendTaiwanPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-3 py-3 text-white md:px-8 md:py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-slate-400 hover:text-white"
            >
              返回首頁
            </Link>
            <h1 className="mt-1 text-xl font-black tracking-tight md:text-3xl">
              台灣今日主題網絡
            </h1>
            <p className="hidden max-w-2xl text-sm leading-6 text-slate-400 md:mt-1 md:block">
              不硬切地區，直接用大主題節點整理今天台灣相關新聞；點開節點就看摘要、來源與相關訊號。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/trend-globe"
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
            >
              回地球村
            </Link>
            <Link
              href="/trend-map"
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
            >
              主題分子圖
            </Link>
          </div>
        </div>

        <TaiwanRoutesMap />
      </div>
    </main>
  );
}
