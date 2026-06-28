export type SignalType =
  | "news"
  | "price"
  | "supply_chain"
  | "company_action"
  | "mixed";

export type SignalStatus =
  | "active"
  | "validated"
  | "partial"
  | "failed";

export type MarketCode =
  | "US"
  | "TW"
  | "KR"
  | "JP"
  | "GLOBAL";

export type SignalEvent = {
  id: string;
  signalDate: string;
  asOfDate: string;
  topic: string;
  signalType: SignalType;
  signalStrength: number;
  confidenceScore: number;
  hypothesis: string;
  evidence: unknown[];
  status: SignalStatus;
  modelVersion?: string;
};

export type SignalWatchlistItem = {
  id: string;
  signalEventId: string;
  symbol: string;
  companyName: string;
  market: MarketCode;
  thesis: string;
  weight: number;
  source?: string;
};

export type StockPrice = {
  symbol: string;
  market: MarketCode;
  priceDate: string;
  close: number;
  adjClose?: number;
  volume?: number;
  provider?: string;
  sourceUrl?: string;
  fetchedAt?: string;
  qualityStatus?: "unverified" | "verified" | "needs_review" | "rejected";
  verificationProvider?: string;
};

export type SignalOutcome = {
  signalEventId: string;
  horizonDays: number;
  basketReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  outcome: "success" | "partial" | "failed" | "pending";
};

export type SignalEvidenceItem = {
  id: string;
  signalEventId: string;
  evidenceDate?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceType: "news" | "price" | "supply_chain" | "company_action" | "official" | "other";
  title: string;
  summary?: string;
  whyItMatters?: string;
  knownAtSignalTime: boolean;
};

export type SignalTimelineEvent = {
  id: string;
  signalEventId: string;
  eventDate?: string;
  eventType: "signal" | "evidence" | "watchlist" | "backtest" | "validation" | "lesson";
  title: string;
  description?: string;
  sourceUrl?: string;
  knownAtSignalTime: boolean;
  displayOrder: number;
};

export type SignalLesson = {
  id: string;
  signalEventId: string;
  lessonType: "what_worked" | "what_failed" | "observation" | "model_update";
  title: string;
  description?: string;
  impact?: string;
};

export type SignalResearchBrief = {
  lane: string;
  whyNow: string;
  causalChain: string[];
  trackingIndicators: string[];
  invalidationConditions: string[];
  evidenceAssessment: {
    level: "high" | "medium" | "early";
    label: string;
    summary: string;
    knownEvidenceCount: number;
    primaryEvidenceCount: number;
    independentSourceCount: number;
  };
  beneficiaryLogic: string;
  dataGaps: string[];
  validationSummary: {
    label: string;
    summary: string;
  };
};
