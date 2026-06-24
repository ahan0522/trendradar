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
};

export type SignalOutcome = {
  signalEventId: string;
  horizonDays: number;
  basketReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  outcome: "success" | "partial" | "failed" | "pending";
};
