import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "TrendRadar | 熱門話題雷達",
  description: "掌握今日熱門話題、趨勢分數、AI 摘要與主要討論來源。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
