"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// /brief carries its own compact disclaimer + legal link already, so the
// full site-wide footer (other product links, extended disclaimer) would
// just be redundant clutter under the report.
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/brief")) return null;

  return (
    <footer className="border-t border-zinc-800 bg-[#05070d] px-4 py-8 text-zinc-500 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <p className="font-black text-zinc-200">TrendRadar</p>
          <p className="mt-2 max-w-3xl text-sm leading-7">
            TrendRadar 是市場研究平台，提供研究訊號、歷史驗證與教育性分析。它不是投顧服務，不提供目標價，也不提供買賣建議。
          </p>
          <p className="mt-3 max-w-3xl text-xs leading-6 text-zinc-600">
            所有訊號都只是研究候選，可能錯誤、不完整或太早出現。使用者應自行查證資料並獨立判斷。
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/brief" className="hover:text-white">市場晨報</Link>
          <Link href="/radar" className="hover:text-white">全市場雷達</Link>
          <Link href="/signals" className="hover:text-white">市場訊號</Link>
          <Link href="/signals/monthly" className="hover:text-white">月度訊號</Link>
          <Link href="/market-map" className="hover:text-white">市場地圖</Link>
          <Link href="/reports/market-brief" className="hover:text-white">每日週報</Link>
          <Link href="/reports/signal-validation" className="hover:text-white">驗證報告</Link>
          <Link href="/failed-signals" className="hover:text-white">失敗紀錄</Link>
        </div>
      </div>
      <div className="mx-auto mt-6 flex max-w-7xl flex-wrap gap-4 border-t border-zinc-900 pt-4 text-xs text-zinc-600">
        <Link href="/legal/disclaimer" className="hover:text-zinc-300">免責聲明</Link>
        <Link href="/legal/terms" className="hover:text-zinc-300">服務條款</Link>
        <Link href="/legal/privacy" className="hover:text-zinc-300">隱私權政策</Link>
      </div>
    </footer>
  );
}
