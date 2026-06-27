import type {
  CommodityQuote,
  CompanyAction,
  IndustryObservation,
} from "@/types/research-data";

function validDate(value: string) {
  return Number.isFinite(new Date(value).getTime());
}

function requireUrl(value: string, field: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error(`${field} must be a valid http(s) URL`);
  }
}

function validateTimeMachineDates(value: {
  publishedAt: string;
  observedAt: string;
  knownAt: string;
}) {
  if (![value.publishedAt, value.observedAt, value.knownAt].every(validDate)) {
    throw new Error("publishedAt, observedAt and knownAt must be valid dates");
  }
  if (new Date(value.knownAt) < new Date(value.publishedAt)) {
    throw new Error("knownAt cannot be earlier than publishedAt");
  }
}

export function validateIndustryObservation(value: IndustryObservation) {
  validateTimeMachineDates(value);
  requireUrl(value.sourceUrl, "sourceUrl");
  if (!value.industry.trim() || !value.metricName.trim()) {
    throw new Error("industry and metricName are required");
  }
  if (value.metricValue === undefined && !value.metricText?.trim()) {
    throw new Error("metricValue or metricText is required");
  }
  if (value.confidenceScore < 0 || value.confidenceScore > 100) {
    throw new Error("confidenceScore must be between 0 and 100");
  }
  return value;
}

export function validateCommodityQuote(value: CommodityQuote) {
  validateTimeMachineDates(value);
  requireUrl(value.sourceUrl, "sourceUrl");
  if (!value.commodityCode.trim() || !value.commodityName.trim()) {
    throw new Error("commodityCode and commodityName are required");
  }
  if (!Number.isFinite(value.price) || value.price <= 0) {
    throw new Error("price must be greater than 0");
  }
  if (!value.currency.trim() || !value.unit.trim()) {
    throw new Error("currency and unit are required");
  }
  return value;
}

export function validateCompanyAction(value: CompanyAction) {
  validateTimeMachineDates(value);
  requireUrl(value.sourceUrl, "sourceUrl");
  if (!value.companySymbol.trim() || !value.market.trim() || !value.title.trim()) {
    throw new Error("companySymbol, market and title are required");
  }
  return value;
}
