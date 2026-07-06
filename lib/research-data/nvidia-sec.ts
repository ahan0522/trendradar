import { createHash } from "node:crypto";
import {
  upsertIndustryObservations,
  upsertResearchSources,
} from "@/lib/research-data/repository";
import type {
  IndustryObservation,
  ResearchSource,
} from "@/types/research-data";

const NVIDIA_RELEASES = [
  {
    url: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000019/q4fy26pr.htm",
    release: "Fiscal Q4 2026",
    periodEnd: "2026-01-25",
  },
  {
    url: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000051/q1fy27pr.htm",
    release: "Fiscal Q1 2027",
    periodEnd: "2026-04-26",
  },
] as const;

const nvidiaSource: ResearchSource = {
  id: "sec-nvidia-exhibits",
  name: "SEC EDGAR NVIDIA Exhibits",
  sourceType: "official",
  baseUrl: "https://www.sec.gov/Archives/edgar/data/1045810/",
  authorityLevel: "primary",
  reliabilityScore: 98,
  metadata: {
    knownAtPolicy: "Conservative end-of-release-date UTC.",
    scopeWarning: "Data Center segment revenue is a demand proxy, not a GPU shipment count.",
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
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function releaseKnownAt(text: string) {
  const match = text.match(
    /\b(Jan\.?|Feb\.?|Mar\.?|Apr\.?|May|June|July|Aug\.?|Sep\.?|Sept\.?|Oct\.?|Nov\.?|Dec\.?|January|February|March|April|August|September|October|November|December) \d{1,2}, \d{4}\b/i,
  );
  if (!match) throw new Error("NVIDIA release date was not found.");
  const parsed = new Date(`${match[0].replace(/\./g, "")} 23:59:59 UTC`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid NVIDIA release date: ${match[0]}`);
  return parsed.toISOString();
}

export function parseNvidiaSecRelease(input: {
  html: string;
  sourceUrl: string;
  release: string;
  periodEnd: string;
  observedAt: string;
}): IndustryObservation[] {
  const text = htmlToText(input.html);
  const knownAt = releaseKnownAt(text);
  const revenue = text.match(/(?:Record quarterly |Record )?Data Center revenue of \$([0-9]+(?:\.[0-9]+)?) billion/i);
  if (!revenue) throw new Error(`NVIDIA Data Center revenue was not found for ${input.release}.`);
  const value = Number(revenue[1]) * 1_000_000_000;
  return [{
    id: `nvidia-exhibit-${stableId(`${input.sourceUrl}|data-center-revenue|${input.periodEnd}`)}`,
    industry: "AI Compute / Data Center",
    metricName: "NVDA Data Center revenue",
    metricValue: value,
    unit: "USD",
    periodEnd: input.periodEnd,
    publishedAt: knownAt,
    observedAt: input.observedAt,
    knownAt,
    sourceId: nvidiaSource.id,
    sourceUrl: input.sourceUrl,
    qualityStatus: "verified",
    confidenceScore: 98,
    metadata: {
      symbol: "NVDA",
      companyName: "NVIDIA",
      release: input.release,
      scope: "company-segment",
      evidenceType: "official-segment-revenue",
      scopeWarning: "Data Center revenue is a demand proxy and is not a GPU or AI server shipment count.",
    },
  }];
}

async function fetchRelease(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html",
      "User-Agent": "TrendRadar/1.0 https://trendradar-prod.vercel.app",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`NVIDIA SEC exhibit request failed: ${response.status} ${url}`);
  return response.text();
}

export async function fetchNvidiaSecData() {
  const observedAt = new Date().toISOString();
  const settled = await Promise.allSettled(NVIDIA_RELEASES.map(async (release) => ({
    release,
    observations: parseNvidiaSecRelease({
      html: await fetchRelease(release.url),
      sourceUrl: release.url,
      release: release.release,
      periodEnd: release.periodEnd,
      observedAt,
    }),
  })));
  const successes = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const failures = settled.flatMap((result, index) => result.status === "rejected"
    ? [{
        url: NVIDIA_RELEASES[index].url,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      }]
    : []);
  if (successes.length === 0 && failures.length > 0) {
    throw new Error(`All NVIDIA SEC exhibits failed: ${failures.map((item) => item.error).join("; ")}`);
  }
  return {
    source: nvidiaSource,
    failures,
    observations: successes.flatMap((item) => item.observations),
  };
}

export async function syncNvidiaSecData(options?: { dryRun?: boolean }) {
  const dryRun = options?.dryRun ?? true;
  const result = await fetchNvidiaSecData();
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
