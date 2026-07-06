import { createHash } from "node:crypto";
import {
  upsertIndustryObservations,
  upsertResearchSources,
} from "@/lib/research-data/repository";
import type {
  IndustryObservation,
  ResearchSource,
} from "@/types/research-data";

const EIA_ROUTE = "https://api.eia.gov/v2/electricity/rto/region-data/data/";

type EiaDemandRow = {
  period?: string;
  respondent?: string;
  "respondent-name"?: string;
  type?: string;
  "type-name"?: string;
  value?: string | number;
  "value-units"?: string;
};

type EiaResponse = {
  response?: {
    data?: EiaDemandRow[];
  };
  error?: string;
};

const eiaSource: ResearchSource = {
  id: "eia-grid-demand",
  name: "U.S. Energy Information Administration Grid Monitor",
  sourceType: "official",
  baseUrl: "https://www.eia.gov/electricity/gridmonitor/",
  authorityLevel: "primary",
  reliabilityScore: 98,
  metadata: {
    dataset: "electricity/rto/region-data",
    scope: "US48 aggregate electricity demand",
    scopeWarning: "This is total grid demand and is not data-center-specific electricity consumption.",
    knownAtPolicy: "First successful TrendRadar retrieval time.",
  },
};

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function publicEiaUrl(startDate: string) {
  const params = new URLSearchParams({
    frequency: "hourly",
    start: `${startDate}T00`,
    length: "5000",
  });
  params.append("data[0]", "value");
  params.append("facets[respondent][]", "US48");
  params.append("facets[type][]", "D");
  params.append("sort[0][column]", "period");
  params.append("sort[0][direction]", "asc");
  return `${EIA_ROUTE}?${params.toString()}`;
}

export function parseEiaGridDemand(input: {
  rows: EiaDemandRow[];
  observedAt: string;
  sourceUrl: string;
}): IndustryObservation[] {
  const daily = new Map<string, number[]>();
  for (const row of input.rows) {
    const period = row.period ?? "";
    const value = Number(row.value);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(period) ||
      row.respondent !== "US48" ||
      row.type !== "D" ||
      !Number.isFinite(value) ||
      value <= 0
    ) {
      continue;
    }
    const date = period.slice(0, 10);
    daily.set(date, [...(daily.get(date) ?? []), value]);
  }

  return [...daily.entries()].flatMap(([date, values]) => {
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const peak = Math.max(...values);
    return [
      {
        id: `eia-demand-${stableId(`US48|${date}|average`)}`,
        industry: "AI Power / Grid",
        metricName: "美國本土電網實際負載（日平均）",
        metricValue: Number(average.toFixed(2)),
        unit: "megawatthours",
        periodStart: date,
        periodEnd: date,
        publishedAt: input.observedAt,
        observedAt: input.observedAt,
        knownAt: input.observedAt,
        sourceId: eiaSource.id,
        sourceUrl: input.sourceUrl,
        qualityStatus: "verified",
        confidenceScore: 95,
        metadata: {
          respondent: "US48",
          measure: "demand",
          aggregation: "daily_average",
          hourlyObservationCount: values.length,
          scope: "general-grid-demand",
          scopeWarning: "Not data-center-specific electricity consumption.",
        },
      },
      {
        id: `eia-demand-${stableId(`US48|${date}|peak`)}`,
        industry: "AI Power / Grid",
        metricName: "美國本土電網實際負載（日峰值）",
        metricValue: peak,
        unit: "megawatthours",
        periodStart: date,
        periodEnd: date,
        publishedAt: input.observedAt,
        observedAt: input.observedAt,
        knownAt: input.observedAt,
        sourceId: eiaSource.id,
        sourceUrl: input.sourceUrl,
        qualityStatus: "verified",
        confidenceScore: 95,
        metadata: {
          respondent: "US48",
          measure: "demand",
          aggregation: "daily_peak",
          hourlyObservationCount: values.length,
          scope: "general-grid-demand",
          scopeWarning: "Not data-center-specific electricity consumption.",
        },
      },
    ] satisfies IndustryObservation[];
  });
}

export async function syncEiaGridDemand(options?: {
  startDate?: string;
  apiKey?: string;
  dryRun?: boolean;
}) {
  const apiKey = options?.apiKey?.trim() || process.env.EIA_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: true,
      dryRun: Boolean(options?.dryRun),
      skipped: true,
      reason: "EIA_API_KEY is not configured.",
      observationCount: 0,
    };
  }
  const startDate = options?.startDate ??
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const observedAt = new Date().toISOString();
  const sourceUrl = publicEiaUrl(startDate);
  const requestUrl = `${sourceUrl}&api_key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(requestUrl, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "TrendRadar/1.0 research-data",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({})) as EiaResponse;
  if (!response.ok) {
    throw new Error(payload.error || `EIA request failed: HTTP ${response.status}`);
  }
  const observations = parseEiaGridDemand({
    rows: payload.response?.data ?? [],
    observedAt,
    sourceUrl,
  });
  if (options?.dryRun ?? true) {
    return {
      ok: true,
      dryRun: true,
      skipped: false,
      observationCount: observations.length,
      samples: observations.slice(0, 4),
    };
  }
  await upsertResearchSources([eiaSource]);
  const result = await upsertIndustryObservations(observations);
  return {
    ok: true,
    dryRun: false,
    skipped: false,
    observationCount: result.count,
  };
}
