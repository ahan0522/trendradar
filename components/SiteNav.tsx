"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Newspaper, Settings, Tags, TrendingUp } from "lucide-react";

const navItems = [
  { href: "/", label: "首頁", icon: Home },
  { href: "/news", label: "新聞", icon: Newspaper },
  { href: "/topics", label: "熱門話題", icon: TrendingUp },
  { href: "/categories", label: "分類", icon: Tags },
  { href: "/settings", label: "設定", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-slate-950">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <BarChart3 className="h-5 w-5" />
          </span>
          <span className="text-lg">TrendRadar</span>
          <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 sm:inline-flex">
            熱門話題雷達
          </span>
        </Link>

        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
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
