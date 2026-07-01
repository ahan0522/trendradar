export type DataQualityStatus =
  | "unverified"
  | "verified"
  | "needs_review"
  | "rejected";

export type ResearchSourceType =
  | "official"
  | "company"
  | "industry"
  | "news"
  | "market_data"
  | "search"
  | "social";

export type ResearchSource = {
  id: string;
  name: string;
  sourceType: ResearchSourceType;
  baseUrl?: string;
  authorityLevel: "primary" | "secondary" | "aggregator";
  reliabilityScore: number;
  metadata?: Record<string, unknown>;
};

export type IndustryObservation = {
  id: string;
  industry: string;
  metricName: string;
  metricValue?: number;
  metricText?: string;
  unit?: string;
  periodStart?: string;
  periodEnd?: string;
  publishedAt: string;
  observedAt: string;
  knownAt: string;
  sourceId?: string;
  sourceUrl: string;
  qualityStatus: DataQualityStatus;
  confidenceScore: number;
  metadata?: Record<string, unknown>;
};

export type CommodityQuote = {
  id: string;
  commodityCode: string;
  commodityName: string;
  quoteDate: string;
  quoteType: "spot" | "contract" | "index" | "estimate";
  price: number;
  currency: string;
  unit: string;
  publishedAt: string;
  observedAt: string;
  knownAt: string;
  sourceId?: string;
  sourceUrl: string;
  qualityStatus: DataQualityStatus;
  verificationSourceId?: string;
  metadata?: Record<string, unknown>;
};

export type CompanyAction = {
  id: string;
  companySymbol: string;
  market: string;
  companyName: string;
  actionType:
    | "guidance"
    | "capex"
    | "capacity"
    | "pricing"
    | "contract"
    | "product"
    | "m_and_a"
    | "filing"
    | "other";
  title: string;
  summary?: string;
  effectiveDate?: string;
  publishedAt: string;
  observedAt: string;
  knownAt: string;
  sourceId?: string;
  sourceUrl: string;
  qualityStatus: DataQualityStatus;
  metadata?: Record<string, unknown>;
};
