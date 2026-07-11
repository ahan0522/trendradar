export type MarketBriefPriceTarget = {
  symbol: string;
  label: string;
  market: "TW" | "US";
  assetType: "index";
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
];

export function marketBriefIndexPriceTargets() {
  return MARKET_BRIEF_INDEX_PRICE_TARGETS.map((item) => ({ ...item }));
}



