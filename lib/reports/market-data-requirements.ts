import type { MarketBriefStatus } from "@/types/market-report";

export type MarketDataRequirementId =
  | "tw-index-prices"
  | "tw-institutional-flows"
  | "tw-sector-movers"
  | "tw-futures-positioning"
  | "tw-options-sentiment"
  | "tw-margin-short"
  | "tw-fx-rates"
  | "us-index-prices"
  | "us-sector-movers"
  | "us-volatility-macro"
  | "global-macro-cross-assets"
  | "market-news-rss";

export type MarketDataRequirement = {
  id: MarketDataRequirementId;
  label: string;
  market: "TW" | "US" | "GLOBAL";
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
    suggestedSources: [
      "TWSE official institutional trading: https://www.twse.com.tw/zh/trading/foreign/twt38u.html",
      "TPEx official institutional trading",
      "verified licensed data provider fallback",
    ],
    blocksReportNumbers: true,
    reason: "缺少外資、投信、自營商單日與累積資料時，不能輸出法人作多作空、連續買賣超與資金方向判讀。",
  },
  {
    id: "tw-sector-movers",
    label: "台股產業漲跌與成分股排行",
    market: "TW",
    priority: "high",
    status: "pending",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["TWSE industry index", "TPEx industry index", "maintained TW sector constituent map", "FinMind API if license permits"],
    blocksReportNumbers: true,
    reason: "缺少產業分類與成分股日漲跌時，不能輸出上漲/下跌產業與前 3-5 個股。",
  },
  {
    id: "tw-futures-positioning",
    label: "外資台指期多空與未平倉",
    market: "TW",
    priority: "high",
    status: "pending",
    requiredFor: ["daily", "weekly"],
    suggestedSources: ["TAIFEX official futures institutional OI", "TAIFEX official large trader data if applicable"],
    blocksReportNumbers: false,
    reason: "期貨多空可強化明日偏多/偏空判斷；未接入前不得輸出台指期淨多單或籌碼結論。",
  },
  {
    id: "tw-options-sentiment",
    label: "選擇權 PCR 與市場情緒",
    market: "TW",
    priority: "medium",
    status: "pending",
    requiredFor: ["daily", "weekly"],
    suggestedSources: ["TAIFEX official options put/call data"],
    blocksReportNumbers: false,
    reason: "選擇權 PCR 可作為情緒輔助指標；未接入前不產生情緒分數。",
  },
  {
    id: "tw-margin-short",
    label: "台股融資融券與信用交易",
    market: "TW",
    priority: "medium",
    status: "pending",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["TWSE official margin trading", "TPEx official margin trading"],
    blocksReportNumbers: false,
    reason: "融資融券可判斷籌碼熱度與風險，但未接入前不輸出信用籌碼結論。",
  },
  {
    id: "tw-fx-rates",
    label: "新台幣匯率與資金壓力",
    market: "TW",
    priority: "medium",
    status: "pending",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["Central Bank of Taiwan exchange rate", "verified FX provider fallback"],
    blocksReportNumbers: false,
    reason: "匯率常影響外資流向；未接入前僅保留為明日分析缺口。",
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
    suggestedSources: ["S&P sector ETF proxies", "Nasdaq/S&P constituent map", "verified US stock prices", "Yahoo Finance rankings if license permits"],
    blocksReportNumbers: true,
    reason: "缺少可信 sector/constituent performance 時，不能輸出上漲/下跌產業與前 3-5 個股。",
  },
  {
    id: "us-volatility-macro",
    label: "美股 VIX 與風險情緒",
    market: "US",
    priority: "medium",
    status: "pending",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["CBOE VIX official data", "verified market data provider fallback"],
    blocksReportNumbers: false,
    reason: "VIX 可輔助判斷隔日風險偏好；未接入前不輸出恐慌或風險分數。",
  },
  {
    id: "global-macro-cross-assets",
    label: "跨資產總經資料",
    market: "GLOBAL",
    priority: "medium",
    status: "pending",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["FRED 10Y yield", "DXY provider", "WTI provider", "Gold provider", "Bitcoin provider", "FedWatch source if license permits"],
    blocksReportNumbers: false,
    reason: "十年債、美元、油金與加密資產可補足明日分析背景；未接入前不輸出跨資產結論。",
  },
  {
    id: "market-news-rss",
    label: "市場新聞 RSS 與事件分群",
    market: "GLOBAL",
    priority: "high",
    status: "partial",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["Reuters RSS", "CNBC RSS", "Yahoo Finance RSS", "MoneyDJ RSS", "工商時報 RSS", "經濟日報 RSS", "鉅亨網 RSS"],
    blocksReportNumbers: false,
    reason: "RSS 分群可解釋市場熱度，但新聞熱度不得取代官方價格、法人與產業硬資料。",
  },
];

export function marketDataRequirementsForReport() {
  return MARKET_DATA_REQUIREMENTS.map((item) => ({ ...item }));
}
