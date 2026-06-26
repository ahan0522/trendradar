import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "TrendRadar | AI-Native Market Signal Engine",
  description: "把新聞、價格、供應鏈與企業行動轉換成可驗證的市場訊號。",
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
