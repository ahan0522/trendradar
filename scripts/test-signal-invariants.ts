import assert from "node:assert/strict";
import {
  buildSignalScoreComponents,
  calculateSignalStrength,
  classifySignalStatus,
  asOfEndIso,
  assertAsOfNotFuture,
} from "../lib/signals/signal-engine";
import {
  addDays,
  isHorizonMature,
  isValidBacktestWindow,
} from "../lib/signals/backtest";
import {
  assessLatestPrice,
  publishableLatestPrice,
} from "../lib/signals/price-quality";
import {
  calculateReturn,
  parseStockPriceCsv,
} from "../lib/signals/stock-prices";

function testSignalScore() {
  assert.equal(calculateSignalStrength({}), 0);
  assert.equal(calculateSignalStrength({
    mentionSpike: 100,
    priceSpike: 100,
    sourceDiversity: 100,
    persistence: 100,
    companyActivity: 100,
    beneficiaryClarity: 100,
  }), 100);
  assert.equal(calculateSignalStrength({ priceSpike: 200 }), 50);
  assert.equal(classifySignalStatus(85), "high_conviction");
  assert.equal(classifySignalStatus(70), "rising");
  assert.equal(classifySignalStatus(50), "watch");
  assert.equal(classifySignalStatus(49.99), "weak");

  const components = buildSignalScoreComponents({
    mentionSpike: 50,
    priceSpike: 40,
    sourceDiversity: 30,
    persistence: 20,
    companyActivity: 10,
    beneficiaryClarity: 60,
  });
  const contribution = components.reduce((sum, item) => sum + item.contribution, 0);
  assert.equal(contribution, 37.5);
}

function testVerifiedPriceGate() {
  const verifiedPrice = {
    priceDate: "2026-06-20",
    close: 1200,
    adjClose: null,
    volume: 1000,
    qualityStatus: "verified",
    provider: "TWSE",
    sourceUrl: "https://www.twse.com.tw/",
  };
  assert.equal(assessLatestPrice("2330.TW", "TW", verifiedPrice, { asOfDate: "2026-06-20" }).status, "verified");
  assert.equal(assessLatestPrice("2330.TW", "TW", {
    ...verifiedPrice,
    qualityStatus: "unverified",
  }).status, "needs_review");
  assert.equal(assessLatestPrice("2330.TW", "TW", {
    ...verifiedPrice,
    provider: null,
  }).status, "needs_review");
  assert.equal(assessLatestPrice("2330.TW", "TW", verifiedPrice, { asOfDate: "2026-06-19" }).status, "needs_review");
  assert.equal(publishableLatestPrice("2330.TW", "TW", verifiedPrice, { asOfDate: "2026-06-19" }).latestPrice, null);
}

function testCsvProvenance() {
  const prices = parseStockPriceCsv([
    "symbol,market,date,close,adj_close,volume,provider,source_url,quality_status",
    "2330.TW,TW,2026-06-20,1200,1200,12345,TWSE,https://www.twse.com.tw/,verified",
  ].join("\n"));
  assert.equal(prices.length, 1);
  assert.equal(prices[0].qualityStatus, "verified");
  assert.equal(prices[0].provider, "TWSE");
  assert.equal(prices[0].sourceUrl, "https://www.twse.com.tw/");
  assert.throws(
    () => parseStockPriceCsv("symbol,market,date,close\nBAD,XX,2026-06-20,10"),
    /Unsupported market/,
  );
}

function testBacktestTimeBoundary() {
  assert.equal(asOfEndIso("2026-03-31"), "2026-03-31T15:59:59.999Z");
  assert.throws(() => asOfEndIso("2026/03/31"), /YYYY-MM-DD/);
  assert.throws(() => asOfEndIso("2026-02-31"), /Invalid asOfDate/);
  assert.doesNotThrow(() => assertAsOfNotFuture("2026-03-31", "2026-03-31"));
  assert.throws(() => assertAsOfNotFuture("2026-04-01", "2026-03-31"), /future/);
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(isHorizonMature("2026-06-01", 30, "2026-06-30"), false);
  assert.equal(isHorizonMature("2026-06-01", 30, "2026-07-01"), true);
  assert.equal(isValidBacktestWindow(
    "2026-06-01",
    "2026-07-01",
    "2026-06-02",
    "2026-07-01",
  ), true);
  assert.equal(isValidBacktestWindow(
    "2026-06-01",
    "2026-07-01",
    "2026-07-02",
    "2026-07-02",
  ), false);
  assert.equal(isValidBacktestWindow(
    "2026-06-01",
    "2026-07-01",
    "2026-06-03",
    "2026-06-02",
  ), false);
  assert.equal(calculateReturn(100, 110), 10);
}

function main() {
  testSignalScore();
  testVerifiedPriceGate();
  testCsvProvenance();
  testBacktestTimeBoundary();
  console.log("Signal research invariants: PASS");
}

main();
