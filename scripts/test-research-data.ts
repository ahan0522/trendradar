import assert from "node:assert/strict";
import { parseGoogleNewsHistoricalRss } from "../lib/historical-news/google-news";
import { parseTwsePublishedAt } from "../lib/research-data/twse";
import { parseFredObservationValue } from "../lib/research-data/fred";
import { parseTpexRocDate } from "../lib/research-data/tpex";

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
console.log("Research data invariants: PASS");
