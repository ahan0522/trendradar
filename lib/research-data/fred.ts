import { createHash } from "node:crypto";
import {
  upsertCommodityQuotes,
  upsertIndustryObservations,
  upsertResearchSources,
} from "@/lib/research-data/repository";
import type {
  CommodityQuote,
  IndustryObservation,
  ResearchSource,
} from "@/types/research-data";

type FredSeries = {
  id: string;
  name: string;
  kind: "commodity" | "industry";
  industry: string;
  unit: string;
  currency?: string;
  quoteType?: CommodityQuote["quoteType"];
};

const fredSource: ResearchSource = {
  id: "fred",
  name: "Federal Reserve Economic Data (FRED)",
  sourceType: "official",
  baseUrl: "https://fred.stlouisfed.org/",
  authorityLevel: "secondary",
  reliabilityScore: 92,
};

const defaultSeries: FredSeries[] = [
  {
    id: "DHHNGSP",
    name: "Henry Hub 天然氣現貨價格",
    kind: "commodity",
    industry: "AI Power / Energy",
    unit: "USD per Million BTU",
    currency: "USD",
    quoteType: "spot",
  },
  {
    id: "WPU10250238",
    name: "銅與銅合金棒材生產者物價指數",
    kind: "commodity",
    industry: "Grid / Transformer",
    unit: "Index",
    currency: "INDEX",
    quoteType: "index",
  },
  {
    id: "CAPUTLHITEK2S",
    name: "高科技製造產能利用率",
    kind: "industry",
    industry: "Semiconductor / Compute",
    unit: "Percent",
  },
];

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function fredCsvUrl(seriesId: string, startDate: string) {
  return `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}&cosd=${encodeURIComponent(startDate)}`;
}

async function fetchFredSeries(series: FredSeries, startDate: string, observedAt: string) {
  const sourceUrl = fredCsvUrl(series.id, startDate);
  const response = await fetch(sourceUrl, {
    cache: "no-store",
    headers: {
      Accept: "text/csv",
      "User-Agent": "TrendRadar/1.0 research-data",
    },
  });
  if (!response.ok) throw new Error(`FRED request failed: ${response.status} ${series.id}`);
  const text = await response.text();
  const lines = text.split(/\r?\n/).slice(1).filter(Boolean);

  return lines.flatMap((line) => {
    const [observationDate, rawValue] = line.split(",");
    const value = Number(rawValue);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observationDate) || !Number.isFinite(value)) return [];
    return [{ observationDate, value, sourceUrl, observedAt }];
  });
}

export async function fetchFredResearchData(options?: {
  startDate?: string;
  seriesIds?: string[];
}) {
  const startDate = options?.startDate ?? "2025-01-01";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("startDate must use YYYY-MM-DD");
  const selected = options?.seriesIds?.length
    ? defaultSeries.filter((series) => options.seriesIds?.includes(series.id))
    : defaultSeries;
  const observedAt = new Date().toISOString();
  const results = await Promise.all(selected.map(async (series) => ({
    series,
    observations: await fetchFredSeries(series, startDate, observedAt),
  })));

  const commodityQuotes: CommodityQuote[] = [];
  const industryObservations: IndustryObservation[] = [];
  for (const result of results) {
    for (const observation of result.observations) {
      if (result.series.kind === "commodity") {
        commodityQuotes.push({
          id: `fred-quote-${stableId(`${result.series.id}|${observation.observationDate}`)}`,
          commodityCode: result.series.id,
          commodityName: result.series.name,
          quoteDate: observation.observationDate,
          quoteType: result.series.quoteType ?? "index",
          price: observation.value,
          currency: result.series.currency ?? "INDEX",
          unit: result.series.unit,
          publishedAt: observation.observedAt,
          observedAt: observation.observedAt,
          knownAt: observation.observedAt,
          sourceId: fredSource.id,
          sourceUrl: observation.sourceUrl,
          qualityStatus: "verified",
          metadata: {
            fredSeriesId: result.series.id,
            observationDate: observation.observationDate,
            timeMachineNote: "Historical observation retrieved now; not treated as known on the observation date.",
          },
        });
      } else {
        industryObservations.push({
          id: `fred-industry-${stableId(`${result.series.id}|${observation.observationDate}`)}`,
          industry: result.series.industry,
          metricName: result.series.name,
          metricValue: observation.value,
          unit: result.series.unit,
          periodStart: observation.observationDate,
          periodEnd: observation.observationDate,
          publishedAt: observation.observedAt,
          observedAt: observation.observedAt,
          knownAt: observation.observedAt,
          sourceId: fredSource.id,
          sourceUrl: observation.sourceUrl,
          qualityStatus: "verified",
          confidenceScore: 85,
          metadata: {
            fredSeriesId: result.series.id,
            observationDate: observation.observationDate,
            timeMachineNote: "Historical observation retrieved now; not treated as known on the observation date.",
          },
        });
      }
    }
  }

  return {
    source: fredSource,
    startDate,
    series: results.map((result) => ({
      id: result.series.id,
      name: result.series.name,
      count: result.observations.length,
      latest: result.observations.at(-1) ?? null,
    })),
    commodityQuotes,
    industryObservations,
  };
}

export async function syncFredResearchData(options?: {
  startDate?: string;
  seriesIds?: string[];
  dryRun?: boolean;
}) {
  const result = await fetchFredResearchData(options);
  const dryRun = options?.dryRun ?? true;
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      source: result.source.name,
      startDate: result.startDate,
      series: result.series,
      commodityQuoteCount: result.commodityQuotes.length,
      industryObservationCount: result.industryObservations.length,
      commoditySamples: result.commodityQuotes.slice(-3),
      industrySamples: result.industryObservations.slice(-3),
    };
  }

  await upsertResearchSources([result.source]);
  const [quotes, observations] = await Promise.all([
    upsertCommodityQuotes(result.commodityQuotes),
    upsertIndustryObservations(result.industryObservations),
  ]);
  return {
    ok: true,
    dryRun: false,
    source: result.source.name,
    startDate: result.startDate,
    series: result.series,
    commodityQuoteCount: quotes.count,
    industryObservationCount: observations.count,
  };
}
