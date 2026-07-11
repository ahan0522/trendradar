import type { MarketBriefStatus } from "@/types/market-report";

export type MarketDataRequirementId =
  | "tw-index-prices"
  | "tw-institutional-flows"
  | "tw-sector-movers"
  | "us-index-prices"
  | "us-sector-movers";

export type MarketDataRequirement = {
  id: MarketDataRequirementId;
  label: string;
  market: "TW" | "US";
  priority: "critical" | "high" | "medium";
  status: MarketBriefStatus;
  requiredFor: Array<"daily" | "weekly" | "monthly">;
  suggestedSources: string[];
  blocksReportNumbers: boolean;
  reason: string;
};

export const MARKET_DATA_REQUIREMENTS: MarketDataRequirement[] = [
  {
    id: "tw-index-prices",
    label: "台股加權與櫃買指數日資料",
    market: "TW",
    priority: "critical",
    status: "partial",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["TWSE official TAIEX history", "TPEx official index", "verified price provider"],
    blocksReportNumbers: true,
    reason: "加權指數已具備 TWSE connector；櫃買指數尚待 TPEx connector，未補齊前台股整體盤勢仍不可視為完整。",
  },
  {
    id: "tw-institutional-flows",
    label: "台股三大法人買賣超",
    market: "TW",
    priority: "critical",
    status: "pending",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["TWSE official institutional trading", "TPEx official institutional trading"],
    blocksReportNumbers: true,
    reason: "缺少外資、投信、自營商單日與累積資料時，不能輸出法人作多作空與連續買賣超。",
  },
  {
    id: "tw-sector-movers",
    label: "台股產業漲跌與成分股排行",
    market: "TW",
    priority: "high",
    status: "pending",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["TWSE industry index", "TPEx industry index", "maintained TW sector constituent map"],
    blocksReportNumbers: true,
    reason: "缺少產業分類與成分股日漲跌時，不能輸出上漲/下跌產業與前 3-5 個股。",
  },
  {
    id: "us-index-prices",
    label: "美股主要指數日資料",
    market: "US",
    priority: "critical",
    status: "pending",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["Yahoo chart", "Alpha Vantage or another independent price provider"],
    blocksReportNumbers: true,
    reason: "美股指數必須至少有同日價格與交叉驗證，否則不輸出漲跌幅與連續漲跌。",
  },
  {
    id: "us-sector-movers",
    label: "美股產業與成分股排行",
    market: "US",
    priority: "high",
    status: "pending",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["S&P sector ETF proxies", "Nasdaq/S&P constituent map", "verified US stock prices"],
    blocksReportNumbers: true,
    reason: "缺少可信 sector/constituent performance 時，不能輸出上漲/下跌產業與前 3-5 個股。",
  },
];

export function marketDataRequirementsForReport() {
  return MARKET_DATA_REQUIREMENTS.map((item) => ({ ...item }));
}
