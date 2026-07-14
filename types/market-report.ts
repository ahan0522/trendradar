export type MarketBriefPeriod = "daily" | "weekly" | "monthly";

export type MarketBriefStatus = "ready" | "partial" | "pending";

export type MarketIndexMove = {
  label: string;
  symbol: string;
  market: "TW" | "US";
  close: number | null;
  changePct: number | null;
  changePoint: number | null;
  streakLabel: string;
  status: MarketBriefStatus;
  dataTier?: "verified" | "provisional";
  reason?: string;
};

export type MarketSectorMove = {
  label: string;
  direction: "up" | "down" | "mixed" | "pending";
  changePct: number | null;
  changePoint: number | null;
  topStocks: Array<{
    symbol: string;
    companyName: string;
    changePct: number | null;
    changePoint: number | null;
    reason?: string;
  }>;
  status: MarketBriefStatus;
  dataTier?: "verified" | "provisional";
  reason?: string;
};

export type InstitutionalFlowSummary = {
  label: "外資" | "投信" | "自營商" | "三大法人";
  singleDayAmount: number | null;
  singleDayBuyAmount: number | null;
  singleDaySellAmount: number | null;
  cumulativeAmount: number | null;
  cumulativeBuyAmount: number | null;
  cumulativeSellAmount: number | null;
  consecutiveDays: number | null;
  direction: "buy" | "sell" | "flat" | "pending";
  unit?: "shares" | "twd";
  sourceUrl?: string;
  sourceUrls?: string[];
  topStocks?: Array<{
    symbol: string;
    companyName: string;
    netAmount: number;
    unit: "shares" | "twd";
  }>;
  status: MarketBriefStatus;
  reason?: string;
};

export type TaiwanFuturesPositioning = {
  contractLabel: string;
  investor: "外資" | "投信" | "自營商" | "三大法人";
  tradeDate: string | null;
  longContracts: number | null;
  shortContracts: number | null;
  netContracts: number | null;
  direction: "net_long" | "net_short" | "flat" | "pending";
  status: MarketBriefStatus;
  sourceUrl?: string;
  reason?: string;
};

export type MarginTradingSummary = {
  tradeDate: string | null;
  marginBalanceLots: number | null;
  marginBalanceChangeLots: number | null;
  marginBalanceAmountTwd: number | null;
  marginBalanceChangeAmountTwd: number | null;
  shortBalanceLots: number | null;
  shortBalanceChangeLots: number | null;
  status: MarketBriefStatus;
  sourceUrl?: string;
  reason?: string;
};

export type OptionsSentimentSummary = {
  tradeDate: string | null;
  putVolume: number | null;
  callVolume: number | null;
  putCallVolumeRatioPct: number | null;
  putCallVolumeRatioChangePct: number | null;
  putOpenInterest: number | null;
  callOpenInterest: number | null;
  putCallOiRatioPct: number | null;
  putCallOiRatioChangePct: number | null;
  comparisonLabel: string | null;
  status: MarketBriefStatus;
  sourceUrl?: string;
  reason?: string;
};

export type FxRateSummary = {
  tradeDate: string | null;
  pair: string;
  rate: number | null;
  changeAmount: number | null;
  changePct: number | null;
  status: MarketBriefStatus;
  dataTier?: "verified" | "provisional";
  sourceUrl?: string;
  reason?: string;
};

export type MarketBriefSignal = {
  id: string;
  topic: string;
  signalStrength: number;
  confidenceScore: number;
  status: MarketBriefStatus;
  watchlist: Array<{
    symbol: string;
    companyName: string;
    market: string;
    reason: string;
  }>;
};

export type MarketBriefSection = {
  market: "TW" | "US";
  title: string;
  status: MarketBriefStatus;
  summary: string;
  indices: MarketIndexMove[];
  sectors: MarketSectorMove[];
  institutionalFlows?: InstitutionalFlowSummary[];
  futuresPositioning?: TaiwanFuturesPositioning[];
  marginTrading?: MarginTradingSummary;
  optionsSentiment?: OptionsSentimentSummary;
  fxRate?: FxRateSummary;
};

export type TomorrowWatchItem = {
  title: string;
  reason: string;
  dataNeeded: string[];
  status: MarketBriefStatus;
};

export type MarketBriefDataQualityItem = {
  label: string;
  status: MarketBriefStatus;
  coverage: string;
  reason?: string;
};

export type MarketBriefOutlook = {
  market: "TW" | "US";
  bias: "constructive" | "cautious" | "mixed" | "pending";
  confidence: "medium" | "low" | "pending";
  summary: string;
  positiveEvidence: string[];
  negativeEvidence: string[];
  unresolvedData: string[];
  nextSessionFocus: string[];
};

export type MarketBriefDataRequirement = {
  id: string;
  label: string;
  market: "TW" | "US" | "GLOBAL";
  priority: "critical" | "high" | "medium";
  status: MarketBriefStatus;
  requiredFor: MarketBriefPeriod[];
  suggestedSources: string[];
  blocksReportNumbers: boolean;
  reason: string;
};

export type MarketBriefPriceTarget = {
  symbol: string;
  label: string;
  market: "TW" | "US";
  assetType: "index" | "sector_etf" | "constituent_stock";
  automationStatus: "ready" | "needs_connector" | "needs_independent_source";
  preferredSource: string;
  reason: string;
};

export type MarketBrief = {
  ok: boolean;
  reportVersion: "market-brief-v1";
  period: MarketBriefPeriod;
  asOfDate: string;
  generatedAt: string;
  reportWindow: {
    startDate: string;
    endDate: string;
  };
  dataPolicy: {
    liveStartDate: string;
    mode: "live-ledger" | "historical-audit";
    caveat: string;
  };
  title: string;
  executiveSummary: string;
  taiwan: MarketBriefSection;
  us: MarketBriefSection;
  outlook: {
    methodVersion: "market-outlook-v1";
    caveat: string;
    taiwan: MarketBriefOutlook;
    us: MarketBriefOutlook;
  };
  signals: MarketBriefSignal[];
  tomorrowWatch: TomorrowWatchItem[];
  weeklyOrMonthlyNotes: string[];
  dataQuality: MarketBriefDataQualityItem[];
  dataRequirements: MarketBriefDataRequirement[];
  priceTargets: MarketBriefPriceTarget[];
  dataGaps: string[];
};





