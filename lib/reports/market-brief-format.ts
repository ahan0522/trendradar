import type { MarketBriefOutlook, MarketBriefStatus } from "@/types/market-report";

export function signedPercent(value: number | null) {
  if (value === null) return "待補";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function signedAmount(value: number | null, decimals = 2) {
  if (value === null) return "待補";
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}`;
}

export function compactAmount(value: number | null, unit?: "shares" | "twd") {
  if (value === null) return "待補";
  const sign = value > 0 ? "+" : "";
  const absolute = Math.abs(value);
  if (unit === "shares") {
    if (absolute >= 100_000_000) return `${sign}${(value / 100_000_000).toFixed(2)} 億股`;
    if (absolute >= 10_000) return `${sign}${(value / 10_000).toFixed(1)} 萬股`;
    return `${sign}${value.toLocaleString("zh-TW")} 股`;
  }
  if (unit === "twd") {
    if (absolute >= 100_000_000) return `${sign}${(value / 100_000_000).toFixed(2)} 億元`;
    if (absolute >= 10_000) return `${sign}${(value / 10_000).toFixed(1)} 萬元`;
    return `${sign}${value.toLocaleString("zh-TW")} 元`;
  }
  return `${sign}${value.toLocaleString("zh-TW")}`;
}

export function statusText(status: MarketBriefStatus) {
  if (status === "ready") return "資料完整";
  if (status === "partial") return "部分資料";
  return "等待資料";
}

export function biasText(outlook: MarketBriefOutlook) {
  if (outlook.bias === "constructive") return "偏多觀察";
  if (outlook.bias === "cautious") return "偏空觀察";
  if (outlook.bias === "mixed") return "多空交錯";
  return "資料不足";
}
