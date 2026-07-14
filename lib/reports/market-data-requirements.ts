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
    label: "台股加權指數與台指期(盤後)日資料",
    market: "TW",
    priority: "critical",
    status: "ready",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["TWSE official TAIEX history", "TAIFEX official DailyMarketReportFut (TX, 盤後)", "verified price provider"],
    blocksReportNumbers: true,
    reason: "加權指數與台指期盤後前月合約皆已有官方 connector；每日/每週/月報仍必須確認資料庫已同步且交易日資料完整才可輸出數字。台指期端點不支援歷史查詢，僅能逐日累積。",
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
      "TWSE BFI82U / TPEx tpex_3insti_summary (金額制)",
      "verified licensed data provider fallback",
    ],
    blocksReportNumbers: true,
    reason: "TWSE T86 已可提供上市外資、投信、自營商與三大法人單日、期間累積與連續買賣；TWSE BFI82U 與 TPEx 官方買賣金額統計表已補上金額制（新台幣元）資料，但該端點僅回傳最新交易日，暫無歷史回補。",
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
    status: "partial",
    requiredFor: ["daily", "weekly"],
    suggestedSources: ["TAIFEX official futures institutional OI", "TAIFEX official large trader data if applicable"],
    blocksReportNumbers: false,
    reason: "已由 TAIFEX 官方三大法人期貨契約未平倉端點提供臺股期貨多單/空單/淨口數；該端點僅回傳最新交易日，尚無法計算連續天數或趨勢，需逐日累積。",
  },
  {
    id: "tw-options-sentiment",
    label: "選擇權 PCR 與市場情緒",
    market: "TW",
    priority: "medium",
    status: "partial",
    requiredFor: ["daily", "weekly"],
    suggestedSources: ["TAIFEX official options put/call data"],
    blocksReportNumbers: false,
    reason: "已由 TAIFEX 官方 PutCallRatio 端點提供臺指選擇權 Put/Call 量與未平倉比值；僅呈現單日數字，不代為判斷多空方向，也尚無法計算連續天數或趨勢。",
  },
  {
    id: "tw-margin-short",
    label: "台股融資融券與信用交易",
    market: "TW",
    priority: "medium",
    status: "partial",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["TWSE official margin trading", "TPEx official margin trading"],
    blocksReportNumbers: false,
    reason: "已由 TWSE 官方 MI_MARGN 信用交易統計端點提供上市融資餘額（張數／金額）與融券餘額（張數）之單日變動；僅涵蓋上市（不含櫃買），且該端點僅回傳最新交易日，尚無法計算連續天數或趨勢。",
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
    status: "partial",
    requiredFor: ["daily", "weekly", "monthly"],
    suggestedSources: ["CBOE VIX official data", "verified market data provider fallback"],
    blocksReportNumbers: false,
    reason: "VIX 已隨美股指數同步（Yahoo 單一來源，標示暫定），並已計入 outlook 證據（方向與一般指數相反）；官方 CBOE 來源與雙來源驗證仍待補齊。",
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









