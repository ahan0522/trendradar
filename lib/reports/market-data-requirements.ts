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
    status: "ready",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["TWSE official TAIEX history", "TPEx official indexInfo/inx", "verified price provider"],
    blocksReportNumbers: true,
    reason: "加權指數與櫃買指數皆已有官方 connector；每日/每週/月報仍必須確認資料庫已同步且交易日資料完整才可輸出數字。",
  },
  {
    id: "tw-institutional-flows",
    label: "台股三大法人買賣超",
    market: "TW",
    priority: "critical",
    status: "partial",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: [
      "TWSE official institutional trading: https://www.twse.com.tw/zh/trading/foreign/twt38u.html",
      "TPEx official institutional trading",
      "verified licensed data provider fallback",
    ],
    blocksReportNumbers: true,
    reason: "TWSE T86 已可提供上市外資、投信、自營商與三大法人單日、期間累積與連續買賣；櫃買法人與金額制資料仍待補齊。",
  },
  {
    id: "tw-sector-movers",
    label: "台股產業漲跌與成分股排行",
    market: "TW",
    priority: "high",
    status: "partial",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["TWSE industry index", "TPEx industry index", "maintained TW sector constituent map", "FinMind API if license permits"],
    blocksReportNumbers: true,
    reason: "已可用維護主題籃子與 verified 台股價格產出內部族群強弱；官方產業指數、櫃買產業與完整成分股仍待補齊。",
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
    status: "partial",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["Yahoo chart", "Alpha Vantage or another independent price provider"],
    blocksReportNumbers: false,
    reason: "Yahoo 單一來源可供日／週報顯示並標示暫定；雙來源同日驗證完成前不得進入回測、Alpha 或成功率。",
  },
  {
    id: "us-sector-movers",
    label: "美股產業與成分股排行",
    market: "US",
    priority: "high",
    status: "partial",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["S&P sector ETF proxies", "Nasdaq/S&P constituent map", "verified US stock prices", "Yahoo Finance rankings if license permits"],
    blocksReportNumbers: false,
    reason: "可用 sector ETF 單一來源暫定行情產出產業方向 proxy；完整成分股排行、個股前 3-5 名與雙來源驗證仍待補齊。",
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









