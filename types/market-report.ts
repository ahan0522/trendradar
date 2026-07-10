export type MarketBriefPeriod = "daily" | "weekly" | "monthly";

export type MarketBriefStatus = "ready" | "partial" | "pending";

export type MarketIndexMove = {
  label: string;
  symbol: string;
  market: "TW" | "US";
  close: number | null;
  changePct: number | null;
  streakLabel: string;
  status: MarketBriefStatus;
  reason?: string;
};

export type MarketSectorMove = {
  label: string;
  direction: "up" | "down" | "mixed" | "pending";
  changePct: number | null;
  topStocks: Array<{
    symbol: string;
    companyName: string;
    changePct: number | null;
    reason?: string;
  }>;
  status: MarketBriefStatus;
  reason?: string;
};

export type InstitutionalFlowSummary = {
  label: "外資" | "投信" | "自營商" | "三大法人";
  singleDayAmount: number | null;
  cumulativeAmount: number | null;
  consecutiveDays: number | null;
  direction: "buy" | "sell" | "flat" | "pending";
  status: MarketBriefStatus;
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

export type MarketBriefDataRequirement = {
  id: string;
  label: string;
  market: "TW" | "US";
  priority: "critical" | "high" | "medium";
  status: MarketBriefStatus;
  requiredFor: MarketBriefPeriod[];
  suggestedSources: string[];
  blocksReportNumbers: boolean;
  reason: string;
};

export type MarketBrief = {
  ok: boolean;
  period: MarketBriefPeriod;
  asOfDate: string;
  generatedAt: string;
  dataPolicy: {
    liveStartDate: string;
    mode: "live-ledger" | "historical-audit";
    caveat: string;
  };
  title: string;
  executiveSummary: string;
  taiwan: MarketBriefSection;
  us: MarketBriefSection;
  signals: MarketBriefSignal[];
  tomorrowWatch: TomorrowWatchItem[];
  weeklyOrMonthlyNotes: string[];
  dataQuality: MarketBriefDataQualityItem[];
  dataRequirements: MarketBriefDataRequirement[];
  dataGaps: string[];
};
