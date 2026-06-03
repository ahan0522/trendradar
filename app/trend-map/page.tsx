import Link from "next/link";
import TrendMoleculeMap from "@/components/TrendMoleculeMap";

export default function TrendMapPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              返回首頁
            </Link>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              今日主題分子圖
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              測試把首頁卡片轉成關聯圖：紅色是大主題，白色是共同點，藍色是可展開的單一訊號。
            </p>
          </div>

          <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
            Prototype
          </div>
        </div>

        <TrendMoleculeMap />
      </div>
    </main>
  );
}
