import { createHash } from "node:crypto";
import {
  upsertIndustryObservations,
  upsertResearchSources,
} from "@/lib/research-data/repository";
import type {
  IndustryObservation,
  ResearchSource,
} from "@/types/research-data";

const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_COMPANY_FACTS_BASE = "https://data.sec.gov/api/xbrl/companyfacts";
const SEC_ARCHIVES_BASE = "https://www.sec.gov/Archives/edgar/data";
const acceptedForms = new Set(["10-Q", "10-K", "20-F", "40-F"]);

type SecTickerRow = {
  cik_str: number;
  ticker: string;
  title: string;
};

type SecFactUnit = {
  start?: string;
  end?: string;
  val?: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
};

export type SecCompanyFacts = {
  cik: number;
  entityName: string;
  facts?: {
    "us-gaap"?: Record<string, {
      label?: string;
      description?: string;
      units?: Record<string, SecFactUnit[]>;
    }>;
  };
};

type FactDefinition = {
  concept: string;
  metricName: string;
  role: "capex" | "inventory" | "revenue";
};

const factDefinitions: FactDefinition[] = [
  {
    concept: "PaymentsToAcquirePropertyPlantAndEquipment",
    metricName: "公司總體資本支出",
    role: "capex",
  },
  {
    concept: "PaymentsToAcquireProductiveAssets",
    metricName: "公司總體資本支出",
    role: "capex",
  },
  {
    concept: "InventoryNet",
    metricName: "公司總體存貨淨額",
    role: "inventory",
  },
  {
    concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
    metricName: "公司總體營收",
    role: "revenue",
  },
  {
    concept: "Revenues",
    metricName: "公司總體營收",
    role: "revenue",
  },
];

const secCompanyFactsSource: ResearchSource = {
  id: "sec-company-facts",
  name: "SEC EDGAR Company Facts",
  sourceType: "official",
  baseUrl: SEC_COMPANY_FACTS_BASE,
  authorityLevel: "primary",
  reliabilityScore: 98,
  metadata: {
    officialDataset: "companyfacts",
    knownAtPolicy: "SEC filing date at 23:59:59 UTC",
    scopeWarning: "Company-wide facts are not treated as AI-specific segment data.",
  },
};

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function secUserAgent() {
  return process.env.SEC_USER_AGENT?.trim() || "TrendRadar/1.0 https://trendradar-prod.vercel.app";
}

async function fetchSecJson<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": secUserAgent(),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`SEC request failed: ${response.status} ${url}`);
  return (await response.json()) as T;
}

function filingDirectoryUrl(cik: number, accession: string) {
  return `${SEC_ARCHIVES_BASE}/${cik}/${accession.replace(/-/g, "")}/`;
}

const companyFactProfiles: Record<string, {
  industry: string;
  roles: FactDefinition["role"][];
}> = {
  MU: {
    industry: "Memory / DRAM / NAND",
    roles: ["capex", "inventory", "revenue"],
  },
  MSFT: { industry: "AI Compute / Cloud Capex", roles: ["capex"] },
  GOOGL: { industry: "AI Compute / Cloud Capex", roles: ["capex"] },
  META: { industry: "AI Compute / Cloud Capex", roles: ["capex"] },
  AMZN: { industry: "AI Compute / Cloud Capex", roles: ["capex"] },
  GEV: {
    industry: "AI Power / Grid",
    roles: ["capex", "inventory", "revenue"],
  },
  ETN: {
    industry: "AI Power / Grid",
    roles: ["capex", "inventory", "revenue"],
  },
  VRT: {
    industry: "AI Cooling / Thermal",
    roles: ["capex", "inventory", "revenue"],
  },
};

export function parseSecCompanyFacts(input: {
  symbol: string;
  facts: SecCompanyFacts;
  since: string;
  observedAt: string;
}): IndustryObservation[] {
  const symbol = input.symbol.toUpperCase();
  const profile = companyFactProfiles[symbol];
  if (!profile) return [];
  const allowedRoles = new Set(profile.roles);
  const selected = new Map<string, {
    definition: FactDefinition;
    unit: string;
    value: SecFactUnit & { val: number; filed: string; end: string; accn: string; form: string };
  }>();
  const gaapFacts = input.facts.facts?.["us-gaap"] ?? {};

  for (const definition of factDefinitions) {
    if (!allowedRoles.has(definition.role)) continue;
    const fact = gaapFacts[definition.concept];
    for (const [unit, units] of Object.entries(fact?.units ?? {})) {
      for (const value of units) {
        if (
          !value.filed ||
          value.filed < input.since ||
          !value.end ||
          !value.accn ||
          !value.form ||
          !acceptedForms.has(value.form) ||
          !Number.isFinite(value.val)
        ) {
          continue;
        }
        const periodKey = `${definition.role}|${value.start ?? ""}|${value.end}|${unit}`;
        const current = selected.get(periodKey);
        if (current && current.value.filed <= value.filed) continue;
        selected.set(periodKey, {
          definition,
          unit,
          value: value as SecFactUnit & {
            val: number;
            filed: string;
            end: string;
            accn: string;
            form: string;
          },
        });
      }
    }
  }

  return [...selected.entries()].map(([periodKey, item]) => {
    const knownAt = `${item.value.filed}T23:59:59.000Z`;
    return {
          id: `sec-fact-${stableId(`${input.facts.cik}|${periodKey}|${item.value.accn}`)}`,
          industry: profile.industry,
          metricName: `${symbol} ${item.definition.metricName}`,
          metricValue: item.value.val,
          unit: item.unit,
          periodStart: item.value.start,
          periodEnd: item.value.end,
          publishedAt: knownAt,
          observedAt: input.observedAt,
          knownAt,
          sourceId: secCompanyFactsSource.id,
          sourceUrl: filingDirectoryUrl(input.facts.cik, item.value.accn),
          qualityStatus: "verified",
          confidenceScore: 95,
          metadata: {
            symbol,
            companyName: input.facts.entityName,
            cik: input.facts.cik,
            accessionNumber: item.value.accn,
            concept: item.definition.concept,
            role: item.definition.role,
            form: item.value.form,
            fiscalYear: item.value.fy ?? null,
            fiscalPeriod: item.value.fp ?? null,
            frame: item.value.frame ?? null,
            officialDataset: "companyfacts",
            scope: "company-wide",
            scopeWarning: "This metric is company-wide and is not an AI-specific segment measure.",
          },
        } satisfies IndustryObservation;
  }).sort((a, b) => a.knownAt.localeCompare(b.knownAt));
}

export async function fetchSecCompanyFacts(options?: {
  symbols?: string[];
  since?: string;
}) {
  const symbols = [...new Set(
    (options?.symbols ?? ["MU", "MSFT", "GOOGL", "META", "AMZN", "GEV", "ETN", "VRT"])
      .map((item) => item.toUpperCase()),
  )].slice(0, 12);
  const since = options?.since ?? new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
  const tickerMap = await fetchSecJson<Record<string, SecTickerRow>>(SEC_TICKERS_URL);
  const byTicker = new Map(Object.values(tickerMap).map((item) => [item.ticker.toUpperCase(), item]));
  const observedAt = new Date().toISOString();

  const companyResults = await Promise.all(symbols.map(async (symbol) => {
    const ticker = byTicker.get(symbol);
    if (!ticker) return { symbol, error: "Ticker not found", observations: [] as IndustryObservation[] };
    const cikPadded = String(ticker.cik_str).padStart(10, "0");
    const facts = await fetchSecJson<SecCompanyFacts>(
      `${SEC_COMPANY_FACTS_BASE}/CIK${cikPadded}.json`,
    );
    return {
      symbol,
      observations: parseSecCompanyFacts({ symbol, facts, since, observedAt }),
    };
  }));

  return {
    source: secCompanyFactsSource,
    symbols,
    since,
    companyResults,
    observations: companyResults.flatMap((item) => item.observations),
  };
}

export async function syncSecCompanyFacts(options?: {
  symbols?: string[];
  since?: string;
  dryRun?: boolean;
}) {
  const result = await fetchSecCompanyFacts(options);
  const dryRun = options?.dryRun ?? true;
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      source: result.source.name,
      since: result.since,
      symbolCount: result.symbols.length,
      observationCount: result.observations.length,
      companies: result.companyResults.map((item) => ({
        symbol: item.symbol,
        observationCount: item.observations.length,
        error: "error" in item ? item.error : undefined,
      })),
      samples: result.observations.slice(0, 5),
    };
  }

  await upsertResearchSources([result.source]);
  const writeResult = await upsertIndustryObservations(result.observations);
  return {
    ok: true,
    dryRun: false,
    source: result.source.name,
    since: result.since,
    symbolCount: result.symbols.length,
    observationCount: writeResult.count,
  };
}
