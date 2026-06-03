import Link from "next/link";
import TrendGlobeMap from "@/components/TrendGlobeMap";

export default function TrendGlobePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-white md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-slate-400 hover:text-white"
            >
              返回首頁
            </Link>
            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
              今日議題地球村
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              測試把熱門主題放到可旋轉的全球視角：紅色是大主題，亮點是共通脈絡，藍點是子訊號。
            </p>
          </div>

          <Link
            href="/trend-map"
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
          >
            回主題分子圖
          </Link>
        </div>

        <TrendGlobeMap />
      </div>
    </main>
  );
}
