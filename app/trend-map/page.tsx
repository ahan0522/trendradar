import Link from "next/link";
import TrendMoleculeMap from "@/components/TrendMoleculeMap";

export default function TrendMapPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e0f2fe_0,_#f8fafc_34%,_#eef2ff_100%)] px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 overflow-hidden rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur md:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              返回首頁
            </Link>
            <div className="mt-4 text-xs font-black uppercase tracking-[0.26em] text-blue-600">
              Topic Molecule
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
              用分子圖看今天的新聞結構
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 md:text-base">
              紅色是大主題，白色是跨主題共同點，彩色小節點是人物、地點、事件或概念。這頁適合快速判斷哪些新聞其實在講同一批脈絡。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/trend-globe"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-700"
            >
              看地球村
            </Link>
            <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
              可互動選取主題
            </span>
          </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-2xl bg-white px-4 py-3 text-slate-600 shadow-sm ring-1 ring-slate-100">
              <span className="font-black text-rose-600">紅點</span> 代表合併後的大主題
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-slate-600 shadow-sm ring-1 ring-slate-100">
              <span className="font-black text-slate-700">白點</span> 代表共同脈絡
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-slate-600 shadow-sm ring-1 ring-slate-100">
              <span className="font-black text-blue-600">彩色點</span> 代表可展開訊號
            </div>
          </div>
        </div>

        <TrendMoleculeMap />
      </div>
    </main>
  );
}
