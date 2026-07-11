export type MarketBriefPriceTarget = {
  symbol: string;
  label: string;
  market: "TW" | "US";
  assetType: "index" | "sector_etf";
  automationStatus: "ready" | "needs_connector" | "needs_independent_source";
  preferredSource: string;
  reason: string;
};

export const MARKET_BRIEF_INDEX_PRICE_TARGETS: MarketBriefPriceTarget[] = [
  {
    symbol: "^TWII",
    label: "加權指數",
    market: "TW",
    assetType: "index",
    automationStatus: "ready",
    preferredSource: "TWSE official TAIEX history endpoint",
    reason: "已由 TWSE MI_5MINS_HIST 官方端點寫入 ^TWII；不可改用個股 STOCK_DAY 抓取。",
  },
  {
    symbol: "^TWOII",
    label: "櫃買指數",
    market: "TW",
    assetType: "index",
    automationStatus: "ready",
    preferredSource: "TPEx official indexInfo/inx endpoint",
    reason: "已由 TPEx 官方櫃買指數月查詢端點寫入 ^TWOII；不可把 ^TWOII 當個股代號送進 tradingStock。",
  },
  {
    symbol: "^DJI",
    label: "道瓊",
    market: "US",
    assetType: "index",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent index close provider",
    reason: "美股正式報告需要雙來源驗證；未確認獨立來源支援道瓊指數前不輸出數字。",
  },
  {
    symbol: "^IXIC",
    label: "那斯達克",
    market: "US",
    assetType: "index",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent index close provider",
    reason: "美股正式報告需要雙來源驗證；未確認獨立來源支援那斯達克指數前不輸出數字。",
  },
  {
    symbol: "^GSPC",
    label: "S&P 500",
    market: "US",
    assetType: "index",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent index close provider",
    reason: "美股正式報告需要雙來源驗證；未確認獨立來源支援 S&P 500 指數前不輸出數字。",
  },
  {
    symbol: "^SOX",
    label: "費城半導體",
    market: "US",
    assetType: "index",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent index close provider",
    reason: "美股正式報告需要雙來源驗證；未確認獨立來源支援費城半導體指數前不輸出數字。",
  },
  {
    symbol: "XLK",
    label: "科技 ETF",
    market: "US",
    assetType: "sector_etf",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent ETF close provider",
    reason: "可作美股科技產業方向 proxy；完整成分股排行與雙來源驗證仍待補齊。",
  },
  {
    symbol: "SMH",
    label: "半導體 ETF",
    market: "US",
    assetType: "sector_etf",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent ETF close provider",
    reason: "可作美股半導體產業方向 proxy；完整成分股排行與雙來源驗證仍待補齊。",
  },
  {
    symbol: "XLC",
    label: "通訊服務 ETF",
    market: "US",
    assetType: "sector_etf",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent ETF close provider",
    reason: "可作美股通訊服務產業方向 proxy；完整成分股排行與雙來源驗證仍待補齊。",
  },
  {
    symbol: "XLY",
    label: "非必需消費 ETF",
    market: "US",
    assetType: "sector_etf",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent ETF close provider",
    reason: "可作美股非必需消費產業方向 proxy；完整成分股排行與雙來源驗證仍待補齊。",
  },
  {
    symbol: "XLF",
    label: "金融 ETF",
    market: "US",
    assetType: "sector_etf",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent ETF close provider",
    reason: "可作美股金融產業方向 proxy；完整成分股排行與雙來源驗證仍待補齊。",
  },
  {
    symbol: "XLI",
    label: "工業 ETF",
    market: "US",
    assetType: "sector_etf",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent ETF close provider",
    reason: "可作美股工業產業方向 proxy；完整成分股排行與雙來源驗證仍待補齊。",
  },
  {
    symbol: "XLE",
    label: "能源 ETF",
    market: "US",
    assetType: "sector_etf",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent ETF close provider",
    reason: "可作美股能源產業方向 proxy；完整成分股排行與雙來源驗證仍待補齊。",
  },
  {
    symbol: "XLV",
    label: "醫療保健 ETF",
    market: "US",
    assetType: "sector_etf",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent ETF close provider",
    reason: "可作美股醫療保健產業方向 proxy；完整成分股排行與雙來源驗證仍待補齊。",
  },
  {
    symbol: "XLP",
    label: "必需消費 ETF",
    market: "US",
    assetType: "sector_etf",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent ETF close provider",
    reason: "可作美股必需消費產業方向 proxy；完整成分股排行與雙來源驗證仍待補齊。",
  },
  {
    symbol: "XLU",
    label: "公用事業 ETF",
    market: "US",
    assetType: "sector_etf",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent ETF close provider",
    reason: "可作美股公用事業產業方向 proxy；完整成分股排行與雙來源驗證仍待補齊。",
  },
  {
    symbol: "XLB",
    label: "原物料 ETF",
    market: "US",
    assetType: "sector_etf",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent ETF close provider",
    reason: "可作美股原物料產業方向 proxy；完整成分股排行與雙來源驗證仍待補齊。",
  },
  {
    symbol: "XLRE",
    label: "不動產 ETF",
    market: "US",
    assetType: "sector_etf",
    automationStatus: "needs_independent_source",
    preferredSource: "Yahoo chart plus independent ETF close provider",
    reason: "可作美股不動產產業方向 proxy；完整成分股排行與雙來源驗證仍待補齊。",
  },
];

export function marketBriefIndexPriceTargets() {
  return MARKET_BRIEF_INDEX_PRICE_TARGETS.map((item) => ({ ...item }));
}







