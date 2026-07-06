import { createHash } from "node:crypto";
import {
  upsertIndustryObservations,
  upsertResearchSources,
} from "@/lib/research-data/repository";
import type {
  IndustryObservation,
  ResearchSource,
} from "@/types/research-data";

const MICRON_RELEASES = [
  {
    url: "https://www.sec.gov/Archives/edgar/data/723125/000072312526000013/a2026q3ex991-pressrelease.htm",
    release: "Fiscal Q3 2026",
  },
] as const;

const micronSource: ResearchSource = {
  id: "sec-micron-exhibits",
  name: "SEC EDGAR Micron Exhibits",
  sourceType: "official",
  baseUrl: "https://www.sec.gov/Archives/edgar/data/723125/",
  authorityLevel: "primary",
  reliabilityScore: 98,
  metadata: {
    knownAtPolicy: "Official release timestamp when available; otherwise conservative end-of-filing-date UTC.",
    scopeWarning: "Company product milestones are not treated as market-wide shipment data.",
  },
};

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function htmlToText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function parseReleaseTimestamp(text: string) {
  const timestamp = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4} at \d{1,2}:\d{2} (?:AM|PM) (?:EST|EDT)\b/i,
  );
  if (timestamp) {
    const parsed = new Date(timestamp[0].replace(" at ", " "));
    if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid Micron release timestamp: ${timestamp[0]}`);
    return parsed.toISOString();
  }
  const date = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/i,
  );
  if (!date) throw new Error("Micron release date was not found.");
  const parsed = new Date(`${date[0]} 23:59:59 UTC`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid Micron release date: ${date[0]}`);
  return parsed.toISOString();
}

export function parseMicronInvestorRelease(input: {
  html: string;
  sourceUrl: string;
  release: string;
  observedAt: string;
}): IndustryObservation[] {
  const text = htmlToText(input.html);
  const knownAt = parseReleaseTimestamp(text);
  const periodEnd = knownAt.slice(0, 10);
  const claims = [
    {
      key: "hbm4-high-volume-shipments",
      metricName: "MU HBM4 高量產出貨狀態",
      pattern: /HBM4, built on 1-beta DRAM technology, is in high-volume shipments for our lead customer's platform, and qualification samples have been shipped to multiple end-customers\./i,
    },
    {
      key: "hbm4e-volume-production-plan",
      metricName: "MU HBM4E 量產時程",
      pattern: /Development of HBM4E, built on 1-gamma DRAM technology, is well underway, with volume production expected in calendar 2027\./i,
    },
  ];

  return claims.flatMap((claim) => {
    const match = text.match(claim.pattern);
    if (!match) return [];
    return [{
      id: `micron-exhibit-${stableId(`${input.sourceUrl}|${claim.key}|${knownAt}`)}`,
      industry: "Memory / DRAM / NAND",
      metricName: claim.metricName,
      metricText: match[0],
      periodEnd,
      publishedAt: knownAt,
      observedAt: input.observedAt,
      knownAt,
      sourceId: micronSource.id,
      sourceUrl: input.sourceUrl,
      qualityStatus: "verified",
      confidenceScore: 96,
      metadata: {
        symbol: "MU",
        companyName: "Micron Technology",
        release: input.release,
        scope: "company-product",
        evidenceType: "official-product-milestone",
        scopeWarning: "Micron product status; not a market-wide shipment or capacity estimate.",
      },
    } satisfies IndustryObservation];
  });
}

async function fetchRelease(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html",
      "User-Agent": "TrendRadar/1.0 research-data",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Micron investor request failed: ${response.status} ${url}`);
  return response.text();
}

export async function fetchMicronInvestorData() {
  const observedAt = new Date().toISOString();
  const settled = await Promise.allSettled(MICRON_RELEASES.map(async (release) => ({
    release,
    observations: parseMicronInvestorRelease({
      html: await fetchRelease(release.url),
      sourceUrl: release.url,
      release: release.release,
      observedAt,
    }),
  })));
  const successes = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const failures = settled.flatMap((result, index) => result.status === "rejected"
    ? [{
        url: MICRON_RELEASES[index].url,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      }]
    : []);
  if (successes.length === 0 && failures.length > 0) {
    throw new Error(`All Micron investor releases failed: ${failures.map((item) => item.error).join("; ")}`);
  }
  return {
    source: micronSource,
    failures,
    observations: successes.flatMap((item) => item.observations),
  };
}

export async function syncMicronInvestorData(options?: { dryRun?: boolean }) {
  const dryRun = options?.dryRun ?? true;
  const result = await fetchMicronInvestorData();
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      source: result.source.name,
      failures: result.failures,
      observationCount: result.observations.length,
      samples: result.observations,
    };
  }
  await upsertResearchSources([result.source]);
  const writeResult = await upsertIndustryObservations(result.observations);
  return {
    ok: true,
    dryRun: false,
    source: result.source.name,
    failures: result.failures,
    observationCount: writeResult.count,
  };
}
