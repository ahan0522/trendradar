import assert from "node:assert/strict";
import { parseGoogleNewsHistoricalRss } from "../lib/historical-news/google-news";
import { parseTwsePublishedAt } from "../lib/research-data/twse";
import { parseFredObservationValue } from "../lib/research-data/fred";
import { parseTpexRocDate } from "../lib/research-data/tpex";
import { researchEvidenceRelevance } from "../lib/signals/evidence-materialization";
import {
  assessEvidenceCoverage,
  detectSignalFamilies,
  getEvidenceRequirementsForSignal,
} from "../lib/signals/evidence-source-registry";

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

function testFredMissingValues() {
  assert.equal(parseFredObservationValue("3.16"), 3.16);
  assert.equal(parseFredObservationValue(" 101.25 "), 101.25);
  assert.equal(parseFredObservationValue(""), null);
  assert.equal(parseFredObservationValue("   "), null);
  assert.equal(parseFredObservationValue("."), null);
  assert.equal(parseFredObservationValue(undefined), null);
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
testFredMissingValues();
testTpexDateParsing();
testHistoricalNewsParsing();
assert.equal(researchEvidenceRelevance("記憶體 HBM 供需", "industry", "Semiconductor / Compute 高科技製造產能利用率"), true);
assert.equal(researchEvidenceRelevance("AI 晶片與算力供應鏈", "industry", "Semiconductor / Compute 半導體與其他電子元件工業生產指數"), true);
assert.equal(researchEvidenceRelevance("AI 資料中心電力與電網", "industry", "AI Power / Grid 電力與特殊變壓器製造生產者物價指數"), true);
assert.equal(researchEvidenceRelevance("AI 電力與資料中心", "commodity", "Henry Hub 天然氣現貨價格"), true);
assert.equal(researchEvidenceRelevance("電網與變壓器", "commodity", "銅與銅合金棒材生產者物價指數"), true);
assert.equal(researchEvidenceRelevance("生技新藥", "commodity", "Henry Hub 天然氣現貨價格"), false);
assert.deepEqual(detectSignalFamilies({ topic: "HBM / DRAM 記憶體供應鏈" }), ["memory"]);
assert.deepEqual(detectSignalFamilies({ topic: "AI 資料中心電力與電網" }), ["ai_compute", "ai_power_grid"]);
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
const powerCoverage = assessEvidenceCoverage({
  topic: "電網與變壓器",
  evidenceItems: [
    { sourceType: "industry", title: "Transformer PPI rises" },
  ],
});
assert.equal(powerCoverage.totalRequiredCount, 2);
assert.equal(powerCoverage.missingRequired.length, 1);
console.log("Research data invariants: PASS");
