"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, CalendarClock, FileText, Home, Map, Radar, TriangleAlert, UserRound } from "lucide-react";

const navItems = [
  { href: "/", label: "產品介紹", icon: Home },
  { href: "/brief", label: "市場晨報", icon: FileText },
  { href: "/radar", label: "全市場雷達", icon: Radar },
  { href: "/signals", label: "市場訊號", icon: Activity },
  { href: "/signals/monthly", label: "月度訊號", icon: CalendarClock },
  { href: "/market-map", label: "市場地圖", icon: Map },
  { href: "/reports/market-brief", label: "每日週報", icon: FileText },
  { href: "/reports/signal-validation", label: "驗證報告", icon: FileText },
  { href: "/failed-signals", label: "失敗紀錄", icon: TriangleAlert },
  { href: "/account", label: "帳號", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// /brief is a standalone report page -- the site-wide app navigation
// (radar, signals, etc.) is unrelated to reading today's report, so it's
// hidden there. The page still links back out via its own masthead.
export function SiteNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/brief")) return null;

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800/80 bg-[#05070d]/92 text-white backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-zinc-950">
            <BarChart3 className="h-5 w-5" />
          </span>
          <span className="text-lg">TrendRadar</span>
          <span className="hidden rounded-full border border-sky-300/30 bg-sky-400/10 px-2.5 py-1 text-xs font-bold text-sky-200 sm:inline-flex">
            Market Research Platform
          </span>
        </Link>

        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition ${
                  active ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                <Icon className="mr-1.5 h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
