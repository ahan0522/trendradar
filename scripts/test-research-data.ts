import assert from "node:assert/strict";
import { parseGoogleNewsHistoricalRss } from "../lib/historical-news/google-news";
import {
  parseTwsePublishedAt,
  parseTwseTaiexIndexPrices,
} from "../lib/research-data/twse";
import {
  FRED_DEFAULT_SERIES,
  parseFredObservationValue,
} from "../lib/research-data/fred";
import { parseEiaGridDemand } from "../lib/research-data/eia-grid-demand";
import { parseMicronInvestorRelease } from "../lib/research-data/micron-investor";
import { parseNvidiaSecRelease } from "../lib/research-data/nvidia-sec";
import { parseTpexRocDate } from "../lib/research-data/tpex";
import {
  EVIDENCE_MATERIALIZATION_VERSION,
  companyActionResearchRelevance,
  researchEvidenceRelevance,
  selectLatestCommodityRows,
  selectLatestIndustryRows,
} from "../lib/signals/evidence-materialization";
import {
  assessEvidenceCoverage,
  detectSignalFamilies,
  getEvidenceRequirementsForSignal,
} from "../lib/signals/evidence-source-registry";
import { researchCoveragePlan } from "../lib/research-data/quality-report";
import {
  parseSecCompanyFacts,
  type SecCompanyFacts,
} from "../lib/research-data/sec-company-facts";

function testTwseTimeParsing() {
  assert.equal(
    parseTwsePublishedAt("1150626", "63427"),
    "2026-06-26T06:34:27+08:00",
  );
  assert.equal(
    parseTwsePublishedAt("1150626", "104316"),
    "2026-06-26T10:43:16+08:00",
  );
  assert.equal(
    parseTwsePublishedAt("1150626", "5"),
    "2026-06-26T00:00:05+08:00",
  );
  assert.throws(
    () => parseTwsePublishedAt("1150626", "246000"),
    /Invalid TWSE time/,
  );
}

function testTwseTaiexIndexParsing() {
  const prices = parseTwseTaiexIndexPrices({
    stat: "OK",
    date: "20260701",
    fields: ["日期", "開盤指數", "最高指數", "最低指數", "收盤指數"],
    data: [
      ["115/07/01", "46,234.70", "47,293.10", "46,234.70", "47,018.99"],
    ],
  }, "https://www.twse.com.tw/rwd/zh/TAIEX/MI_5MINS_HIST?date=20260701&response=json", "2026-07-11T00:00:00.000Z");

  assert.equal(prices.length, 1);
  assert.equal(prices[0].symbol, "^TWII");
  assert.equal(prices[0].market, "TW");
  assert.equal(prices[0].price_date, "2026-07-01");
  assert.equal(prices[0].close, 47018.99);
  assert.equal(prices[0].quality_status, "verified");
  assert.equal(prices[0].verification_provider, "twse-openapi");
}

function testFredMissingValues() {
  assert.equal(parseFredObservationValue("3.16"), 3.16);
  assert.equal(parseFredObservationValue(" 101.25 "), 101.25);
  assert.equal(parseFredObservationValue(""), null);
  assert.equal(parseFredObservationValue("   "), null);
  assert.equal(parseFredObservationValue("."), null);
  assert.equal(parseFredObservationValue(undefined), null);
}

function testFredPowerSeriesRegistry() {
  const ids = new Set(FRED_DEFAULT_SERIES.map((series) => series.id));
  assert.equal(ids.has("PCU335311335311"), true);
  assert.equal(ids.has("WPU117409"), true);
  assert.equal(ids.has("IPG3353S"), true);
  assert.equal(ids.has("IPG22112S"), true);
  assert.equal(ids.has("IPG2211S"), true);
  assert.equal(ids.has("CAPUTLG2211S"), true);
}

function testEiaGridDemandParsing() {
  const observations = parseEiaGridDemand({
    observedAt: "2026-07-06T10:00:00.000Z",
    sourceUrl: "https://api.eia.gov/v2/electricity/rto/region-data/data/",
    rows: [
      { period: "2026-07-05T00", respondent: "US48", type: "D", value: "400000" },
      { period: "2026-07-05T01", respondent: "US48", type: "D", value: "500000" },
      { period: "2026-07-05T02", respondent: "OTHER", type: "D", value: "900000" },
      { period: "invalid", respondent: "US48", type: "D", value: "1" },
    ],
  });
  assert.equal(observations.length, 2);
  assert.equal(
    observations.find((item) => item.metadata?.aggregation === "daily_average")?.metricValue,
    450000,
  );
  assert.equal(
    observations.find((item) => item.metadata?.aggregation === "daily_peak")?.metricValue,
    500000,
  );
  assert.equal(
    observations.every((item) => item.metadata?.scope === "general-grid-demand"),
    true,
  );
}

function testMicronInvestorReleaseParsing() {
  const observations = parseMicronInvestorRelease({
    html: `
      <div>June 24, 2026 at 4:01 PM EDT</div>
      <li>HBM4, built on 1-beta DRAM technology, is in high-volume shipments for our lead customer's platform, and qualification samples have been shipped to multiple end-customers.</li>
      <li>Development of HBM4E, built on 1-gamma DRAM technology, is well underway, with volume production expected in calendar 2027.</li>
    `,
    sourceUrl: "https://investors.micron.com/node/50671",
    release: "Fiscal Q3 2026",
    observedAt: "2026-07-06T12:00:00.000Z",
  });
  assert.equal(observations.length, 2);
  assert.equal(observations[0].knownAt, "2026-06-24T20:01:00.000Z");
  assert.equal(observations.every((item) => item.qualityStatus === "verified"), true);
  assert.equal(observations.every((item) => item.metadata?.scope === "company-product"), true);
  assert.equal(observations.some((item) => item.metricName.includes("HBM4E")), true);
  const conservativeDate = parseMicronInvestorRelease({
    html: `
      <div>BOISE, Idaho, June&#160;24, 2026 &#8211; Micron announced results.</div>
      <li>HBM4, built on 1-beta DRAM technology, is in high-volume shipments for our lead customer's platform, and qualification samples have been shipped to multiple end-customers.</li>
    `,
    sourceUrl: "https://www.sec.gov/example.htm",
    release: "Fiscal Q3 2026",
    observedAt: "2026-07-06T12:00:00.000Z",
  });
  assert.equal(conservativeDate[0].knownAt, "2026-06-24T23:59:59.000Z");
}

function testNvidiaSecReleaseParsing() {
  const observations = parseNvidiaSecRelease({
    html: `
      <div>NVIDIA Announces Financial Results</div>
      <div>SANTA CLARA, Calif.—May 20, 2026—NVIDIA reported results.</div>
      <li>Record Data Center revenue of $75.2 billion, up 92% from a year ago</li>
    `,
    sourceUrl: "https://www.sec.gov/example.htm",
    release: "Fiscal Q1 2027",
    periodEnd: "2026-04-26",
    observedAt: "2026-07-06T12:00:00.000Z",
  });
  assert.equal(observations.length, 1);
  assert.equal(observations[0].metricValue, 75_200_000_000);
  assert.equal(observations[0].knownAt, "2026-05-20T23:59:59.000Z");
  assert.equal(observations[0].metadata?.scope, "company-segment");
}

function testResearchCoveragePlan() {
  const byKey = new Map(researchCoveragePlan.map((item) => [item.key, item]));
  assert.equal(byKey.get("power_grid_equipment")?.status, "automated");
  assert.equal(byKey.get("memory_pricing")?.status, "licensed_or_manual_required");
  assert.equal(byKey.get("ai_server_shipments")?.status, "partial");
  assert.deepEqual(
    byKey.get("ai_server_shipments")?.automatedSources,
    ["SEC EDGAR NVIDIA Exhibits"],
  );
  assert.match(
    byKey.get("ai_server_shipments")?.note ?? "",
    /不得標示為出貨量/,
  );
  assert.equal(byKey.get("cloud_capex")?.status, "partial");
}

function testCurrentEvidenceVersion() {
  assert.equal(EVIDENCE_MATERIALIZATION_VERSION, "evidence-v7");
}

function testLatestResearchObservationSelection() {
  const industries = selectLatestIndustryRows([
    { id: "old", metric_name: "capacity", period_end: "2025-01-01", known_at: "2026-06-27" },
    { id: "new", metric_name: "capacity", period_end: "2026-05-01", known_at: "2026-06-27" },
  ]);
  assert.equal(industries.get("capacity")?.id, "new");

  const commodities = selectLatestCommodityRows([
    { id: "old", commodity_code: "COPPER", quote_date: "2003-12-01", known_at: "2026-07-02" },
    { id: "new", commodity_code: "COPPER", quote_date: "2026-05-01", known_at: "2026-07-02" },
  ]);
  assert.equal(commodities.get("COPPER")?.id, "new");
}

function testSecCompanyFactsParsing() {
  const facts: SecCompanyFacts = {
    cik: 723125,
    entityName: "MICRON TECHNOLOGY INC",
    facts: {
      "us-gaap": {
        InventoryNet: {
          units: {
            USD: [
              {
                end: "2026-02-26",
                val: 9000000000,
                accn: "0000723125-26-000010",
                fy: 2026,
                fp: "Q2",
                form: "10-Q",
                filed: "2026-03-26",
              },
            ],
          },
        },
        PaymentsToAcquirePropertyPlantAndEquipment: {
          units: {
            USD: [
              {
                start: "2025-09-01",
                end: "2026-02-26",
                val: 7000000000,
                accn: "0000723125-26-000010",
                fy: 2026,
                fp: "Q2",
                form: "10-Q",
                filed: "2026-03-26",
              },
            ],
          },
        },
        PaymentsToAcquireProductiveAssets: {
          units: {
            USD: [
              {
                start: "2025-09-01",
                end: "2026-02-26",
                val: 7100000000,
                accn: "0000723125-26-000011",
                fy: 2026,
                fp: "Q2",
                form: "10-Q",
                filed: "2026-03-27",
              },
            ],
          },
        },
      },
    },
  };
  const observations = parseSecCompanyFacts({
    symbol: "MU",
    facts,
    since: "2026-01-01",
    observedAt: "2026-07-05T12:00:00.000Z",
  });
  assert.equal(observations.length, 2);
  assert.equal(observations[0].knownAt, "2026-03-26T23:59:59.000Z");
  assert.equal(observations.every((item) => item.metadata?.scope === "company-wide"), true);
  assert.equal(observations.some((item) => item.metricName.includes("存貨")), true);
  assert.equal(
    observations.find((item) => item.metricName.includes("資本支出"))?.metricValue,
    7000000000,
  );
  const coolingObservations = parseSecCompanyFacts({
    symbol: "VRT",
    facts,
    since: "2026-01-01",
    observedAt: "2026-07-05T12:00:00.000Z",
  });
  assert.equal(coolingObservations.length, 2);
  assert.equal(
    coolingObservations.every((item) => item.industry === "AI Cooling / Thermal"),
    true,
  );
  assert.equal(parseSecCompanyFacts({
    symbol: "UNKNOWN",
    facts,
    since: "2026-01-01",
    observedAt: "2026-07-05T12:00:00.000Z",
  }).length, 0);
}

function testTpexDateParsing() {
  assert.equal(parseTpexRocDate("1150626"), "2026-06-26");
  assert.throws(() => parseTpexRocDate("1150230"), /Invalid TPEx ROC date/);
}

function testHistoricalNewsParsing() {
  const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title>AI data center investment expands - Example News</title>
        <link>https://news.google.com/rss/articles/example-one</link>
        <pubDate>Wed, 22 Jan 2025 08:00:00 GMT</pubDate>
        <description>Historical metadata</description>
        <source url="https://example.com">Example News</source>
      </item>
      <item>
        <title>Outside month - Example News</title>
        <link>https://news.google.com/rss/articles/example-two</link>
        <pubDate>Sat, 01 Feb 2025 08:00:00 GMT</pubDate>
        <source url="https://example.com">Example News</source>
      </item>
    </channel></rss>`;
  const articles = parseGoogleNewsHistoricalRss(xml, {
    query: "人工智慧 AI 產業",
    startDate: "2025-01-01",
    endDate: "2025-01-31",
  });
  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, "AI data center investment expands");
  assert.equal(articles[0].sourceName, "Example News");
  assert.equal(articles[0].publishedAt, "2025-01-22T08:00:00.000Z");
  assert.equal(articles[0].category, "AI");
}

testTwseTimeParsing();
testTwseTaiexIndexParsing();
testFredMissingValues();
testTpexDateParsing();
testHistoricalNewsParsing();
testFredPowerSeriesRegistry();
testEiaGridDemandParsing();
testMicronInvestorReleaseParsing();
testNvidiaSecReleaseParsing();
testResearchCoveragePlan();
testCurrentEvidenceVersion();
testLatestResearchObservationSelection();
testSecCompanyFactsParsing();
assert.equal(researchEvidenceRelevance("記憶體 HBM 供需", "industry", "Semiconductor / Compute 高科技製造產能利用率"), false);
assert.equal(researchEvidenceRelevance("記憶體 HBM 供需", "industry", "Memory DRAM capacity utilization"), true);
assert.equal(researchEvidenceRelevance("AI 晶片與算力供應鏈", "industry", "Semiconductor / Compute 半導體與其他電子元件工業生產指數"), true);
assert.equal(researchEvidenceRelevance("AI 資料中心電力與電網", "industry", "AI Power / Grid 電力與特殊變壓器製造生產者物價指數"), true);
assert.equal(researchEvidenceRelevance("AI 資料中心電力與電網", "industry", "Semiconductor / Compute 高科技製造產能利用率"), false);
assert.equal(researchEvidenceRelevance("AI 電力與資料中心", "commodity", "Henry Hub 天然氣現貨價格"), true);
assert.equal(researchEvidenceRelevance("電網與變壓器", "commodity", "銅與銅合金棒材生產者物價指數"), true);
assert.equal(researchEvidenceRelevance("AI 算力與資料中心", "commodity", "Henry Hub 天然氣現貨價格"), false);
assert.equal(researchEvidenceRelevance("AI 算力與資料中心", "commodity", "銅與銅合金棒材生產者物價指數"), false);
assert.equal(researchEvidenceRelevance("生技新藥", "commodity", "Henry Hub 天然氣現貨價格"), false);
assert.equal(companyActionResearchRelevance({
  signalText: "記憶體 HBM DRAM",
  actionType: "pricing",
  title: "公告取得機器設備",
  summary: "設備用於 DRAM 生產與產能擴充。",
}), true);
assert.equal(companyActionResearchRelevance({
  signalText: "AI 算力與資料中心",
  actionType: "filing",
  title: "公告獨立董事辭任",
  summary: "董事會成員異動。",
}), false);
assert.equal(companyActionResearchRelevance({
  signalText: "AI 算力與資料中心",
  actionType: "filing",
  title: "10-Q：10-Q",
  summary: "SEC EDGAR 正式申報，申報日 2026-05-20，報告期間 2026-04-26。",
}), false);
assert.equal(companyActionResearchRelevance({
  signalText: "電力、電網與資料中心能源",
  actionType: "contract",
  title: "取得大型變壓器供應合約",
}), true);
assert.deepEqual(detectSignalFamilies({ topic: "HBM / DRAM 記憶體供應鏈" }), ["memory"]);
assert.deepEqual(detectSignalFamilies({ topic: "AI 資料中心電力與電網" }), ["ai_compute", "ai_power_grid"]);
assert.deepEqual(detectSignalFamilies({ topic: "具身 AI 機器人平台發表" }), ["robotics_embodied_ai"]);
assert.equal(
  getEvidenceRequirementsForSignal({ topic: "AI 晶片與算力供應鏈" }).requirements.some((item) => item.key === "compute_shipments"),
  true,
);
const memoryCoverage = assessEvidenceCoverage({
  topic: "HBM / DRAM 記憶體供應鏈",
  evidenceItems: [
    { sourceType: "commodity", title: "DRAM contract price rises" },
    { sourceType: "industry", title: "Memory capacity utilization improves" },
  ],
});
assert.equal(memoryCoverage.totalRequiredCount, 2);
assert.equal(memoryCoverage.missingRequired.length, 0);
const genericMemoryCoverage = assessEvidenceCoverage({
  topic: "HBM / DRAM 記憶體供應鏈",
  evidenceItems: [
    { sourceType: "industry", title: "高科技製造產能利用率" },
  ],
});
assert.equal(genericMemoryCoverage.satisfiedRequiredCount, 0);
assert.equal(genericMemoryCoverage.missingRequired.length, 2);
const powerCoverage = assessEvidenceCoverage({
  topic: "電網與變壓器",
  evidenceItems: [
    { sourceType: "industry", title: "Transformer PPI rises" },
  ],
});
assert.equal(powerCoverage.totalRequiredCount, 2);
assert.equal(powerCoverage.missingRequired.length, 1);
const roboticsCoverage = assessEvidenceCoverage({
  topic: "具身 AI 機器人平台發表",
  evidenceItems: [
    { sourceType: "company_action", title: "robotics product launch and customer deployment" },
  ],
});
assert.equal(roboticsCoverage.totalRequiredCount, 2);
assert.equal(roboticsCoverage.satisfiedRequiredCount, 1);
assert.equal(roboticsCoverage.missingRequired[0].key, "robotics_orders_adoption");
console.log("Research data invariants: PASS");
