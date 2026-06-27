import { createHash } from "node:crypto";
import {
  upsertCompanyActions,
  upsertResearchSources,
} from "@/lib/research-data/repository";
import type { CompanyAction, ResearchSource } from "@/types/research-data";

const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_SUBMISSIONS_BASE = "https://data.sec.gov/submissions";
const SEC_ARCHIVES_BASE = "https://www.sec.gov/Archives/edgar/data";
const acceptedForms = new Set(["8-K", "10-Q", "10-K", "6-K", "20-F", "40-F"]);

type SecTickerRow = {
  cik_str: number;
  ticker: string;
  title: string;
};

type SecSubmissions = {
  name: string;
  tickers?: string[];
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      acceptanceDateTime?: string[];
      form?: string[];
      primaryDocument?: string[];
      primaryDocDescription?: string[];
    };
  };
};

const secSource: ResearchSource = {
  id: "sec-edgar",
  name: "SEC EDGAR",
  sourceType: "official",
  baseUrl: "https://www.sec.gov/edgar",
  authorityLevel: "primary",
  reliabilityScore: 98,
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
  });
  if (!response.ok) throw new Error(`SEC request failed: ${response.status} ${url}`);
  return (await response.json()) as T;
}

function toIsoTimestamp(value: string | undefined, fallbackDate: string) {
  if (value && Number.isFinite(new Date(value).getTime())) return new Date(value).toISOString();
  return `${fallbackDate}T23:59:59.000Z`;
}

function filingUrl(cik: number, accession: string, primaryDocument: string) {
  const accessionPath = accession.replace(/-/g, "");
  return `${SEC_ARCHIVES_BASE}/${cik}/${accessionPath}/${primaryDocument}`;
}

function classifyFiling(form: string, description: string): CompanyAction["actionType"] {
  const text = `${form} ${description}`.toLowerCase();
  if (/guidance|forecast|outlook/.test(text)) return "guidance";
  if (/acquisition|merger|acquire/.test(text)) return "m_and_a";
  if (/agreement|contract|order/.test(text)) return "contract";
  if (/product|launch/.test(text)) return "product";
  return "filing";
}

export async function fetchSecCompanyActions(options?: {
  symbols?: string[];
  since?: string;
  limitPerCompany?: number;
}) {
  const symbols = [...new Set((options?.symbols ?? ["NVDA", "AMD", "MU", "GEV", "ETN", "VRT", "AMKR", "ABB"]).map((item) => item.toUpperCase()))];
  const since = options?.since ?? new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
  const limitPerCompany = Math.max(1, Math.min(options?.limitPerCompany ?? 20, 100));
  const tickerMap = await fetchSecJson<Record<string, SecTickerRow>>(SEC_TICKERS_URL);
  const byTicker = new Map(Object.values(tickerMap).map((item) => [item.ticker.toUpperCase(), item]));
  const observedAt = new Date().toISOString();

  const companyResults = await Promise.all(
    symbols.map(async (symbol) => {
      const ticker = byTicker.get(symbol);
      if (!ticker) return { symbol, error: "Ticker not found in SEC company_tickers.json", actions: [] as CompanyAction[] };

      const cikPadded = String(ticker.cik_str).padStart(10, "0");
      const submissions = await fetchSecJson<SecSubmissions>(`${SEC_SUBMISSIONS_BASE}/CIK${cikPadded}.json`);
      const recent = submissions.filings?.recent;
      if (!recent) return { symbol, error: "No recent submissions", actions: [] as CompanyAction[] };

      const actions: CompanyAction[] = [];
      for (let index = 0; index < (recent.form?.length ?? 0); index += 1) {
        const form = recent.form?.[index] ?? "";
        const filingDate = recent.filingDate?.[index] ?? "";
        const accession = recent.accessionNumber?.[index] ?? "";
        const primaryDocument = recent.primaryDocument?.[index] ?? "";
        if (!acceptedForms.has(form) || filingDate < since || !accession || !primaryDocument) continue;

        const description = recent.primaryDocDescription?.[index]?.trim() || `${form} filing`;
        const publishedAt = toIsoTimestamp(recent.acceptanceDateTime?.[index], filingDate);
        const sourceUrl = filingUrl(ticker.cik_str, accession, primaryDocument);
        actions.push({
          id: `sec-action-${stableId(`${ticker.cik_str}|${accession}|${form}`)}`,
          companySymbol: symbol,
          market: "US",
          companyName: submissions.name || ticker.title,
          actionType: classifyFiling(form, description),
          title: `${form}：${description}`,
          summary: `SEC EDGAR 正式申報，申報日 ${filingDate}${recent.reportDate?.[index] ? `，報告期間 ${recent.reportDate[index]}` : ""}。`,
          effectiveDate: recent.reportDate?.[index] || filingDate,
          publishedAt,
          observedAt,
          knownAt: publishedAt,
          sourceId: secSource.id,
          sourceUrl,
          qualityStatus: "verified",
          metadata: {
            cik: ticker.cik_str,
            form,
            accessionNumber: accession,
            officialDataset: "submissions",
          },
        });
        if (actions.length >= limitPerCompany) break;
      }

      return { symbol, actions };
    }),
  );

  return {
    source: secSource,
    symbols,
    since,
    companyResults,
    actions: companyResults.flatMap((item) => item.actions),
  };
}

export async function syncSecResearchData(options?: {
  symbols?: string[];
  since?: string;
  limitPerCompany?: number;
  dryRun?: boolean;
}) {
  const result = await fetchSecCompanyActions(options);
  const dryRun = options?.dryRun ?? true;

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      source: result.source.name,
      since: result.since,
      symbolCount: result.symbols.length,
      actionCount: result.actions.length,
      companies: result.companyResults.map((item) => ({
        symbol: item.symbol,
        actionCount: item.actions.length,
        error: "error" in item ? item.error : undefined,
      })),
      samples: result.actions.slice(0, 5),
    };
  }

  await upsertResearchSources([result.source]);
  const writeResult = await upsertCompanyActions(result.actions);
  return {
    ok: true,
    dryRun: false,
    source: result.source.name,
    since: result.since,
    symbolCount: result.symbols.length,
    actionCount: writeResult.count,
  };
}
