import assert from "node:assert/strict";
import {
  buildSignalScoreComponents,
  calculateSignalStrength,
  classifySignalStatus,
  asOfEndIso,
  assertAsOfNotFuture,
  buildEvidenceBasedHypothesis,
  resolveSignalIdentity,
  selectHighestConviction,
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
import {
  articleMatchesRule,
  textMatchesTopicKeyword,
} from "../lib/topic-grouping";
import { calculateHeatLifecycle } from "../lib/discovery/heat-lifecycle";
import { buildSignalResearchBrief } from "../lib/signals/research-brief";
import { normalizeSignalFamily } from "../lib/signals/model-replay";

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
  const selected = selectHighestConviction([
    { id: "weak", signal_strength: 30, confidence_score: 90 },
    { id: "strong", signal_strength: 80, confidence_score: 70 },
    { id: "tie-low", signal_strength: 60, confidence_score: 50 },
    { id: "tie-high", signal_strength: 60, confidence_score: 80 },
  ], 3);
  assert.deepEqual(selected.map((item) => item.id), ["strong", "tie-high", "tie-low"]);
  const cpoHypothesis = buildEvidenceBasedHypothesis(
    "訊芯具 CPO 量產能力，掌握面板級封裝商機",
    2,
  );
  assert.match(cpoHypothesis, /CPO、矽光子與封裝量產/);
  assert.match(cpoHypothesis, /2 個獨立來源/);
  assert.doesNotMatch(cpoHypothesis, /英特爾|特斯拉/);
}

function testTopicKeywordBoundaries() {
  assert.equal(textMatchesTopicKeyword("AI server demand rises", "ai"), true);
  assert.equal(textMatchesTopicKeyword("The company said demand rose", "ai"), false);
  assert.equal(textMatchesTopicKeyword("台積電推進人工智慧晶片", "人工智慧"), true);
  assert.equal(textMatchesTopicKeyword("防洪與地方政治新聞", "ai"), false);
  assert.equal(articleMatchesRule({
    id: "category-only",
    title: "地方防洪工程進度",
    description: "市府今日說明工程狀況",
    sourceName: "Example",
    category: "AI",
    publishedAt: "2026-06-27T00:00:00Z",
  }, ["ai", "gpu"]), false);
  assert.equal(articleMatchesRule({
    id: "two-description-signals",
    title: "資料中心供應鏈更新",
    description: "AI server 採用更多 GPU",
    sourceName: "Example",
    category: "科技",
    publishedAt: "2026-06-27T00:00:00Z",
  }, ["ai", "gpu"]), true);
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

function testSignalIdentityContinuity() {
  const existing = [{
    id: "auto-2026-06-27-cpo",
    signal_date: "2026-06-27",
    topic: "訊芯具 CPO 量產能力",
  }];
  assert.deepEqual(
    resolveSignalIdentity("訊芯具 CPO 量產能力", "2026-06-28", existing),
    {
      id: "auto-2026-06-27-cpo",
      signalDate: "2026-06-27",
      isNew: false,
    },
  );
  assert.equal(
    resolveSignalIdentity("AI 電力基礎建設", "2026-06-28", existing).isNew,
    true,
  );
  assert.equal(
    resolveSignalIdentity("訊芯具 CPO 量產能力", "2026-06-26", existing).isNew,
    true,
  );
}

function testHeatLifecycle() {
  const articleDates = (dates: string[]) =>
    dates.map((date) => `${date}T08:00:00.000Z`);
  const sustained = calculateHeatLifecycle({
    asOfDate: "2026-06-28",
    sourceCount: 5,
    publishedAt: articleDates([
      "2026-06-02", "2026-06-05", "2026-06-09", "2026-06-12",
      "2026-06-16", "2026-06-18", "2026-06-20", "2026-06-22",
      "2026-06-23", "2026-06-24", "2026-06-25", "2026-06-26",
      "2026-06-27", "2026-06-28",
    ]),
  });
  assert.equal(sustained.state, "sustained_high");
  assert.ok(sustained.persistenceScore >= 70);

  const breakout = calculateHeatLifecycle({
    asOfDate: "2026-06-28",
    sourceCount: 3,
    publishedAt: [
      "2026-06-28T02:00:00.000Z",
      "2026-06-28T06:00:00.000Z",
      "2026-06-28T10:00:00.000Z",
    ],
  });
  assert.equal(breakout.state, "breaking_out");

  const cooling = calculateHeatLifecycle({
    asOfDate: "2026-06-28",
    sourceCount: 4,
    publishedAt: articleDates([
      "2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18",
      "2026-06-19", "2026-06-20", "2026-06-27",
    ]),
  });
  assert.equal(cooling.state, "cooling");
}

function testResearchBrief() {
  const signal = {
    topic: "2026-05 半導體與先進製程",
    hypothesis: "先進製程需求正在擴散到設備與封測供應鏈。",
    signalStrength: 70,
    confidenceScore: 82,
    asOfDate: "2026-05-31",
    evidence: [{ source_count: 4, article_count: 12 }],
  };
  const brief = buildSignalResearchBrief({
    signal,
    evidenceItems: [
      { sourceName: "A", sourceType: "news", knownAtSignalTime: true },
      { sourceName: "B", sourceType: "news", knownAtSignalTime: true },
      { sourceName: "C", sourceType: "company_action", knownAtSignalTime: true },
    ],
    watchlists: [{ symbol: "2330.TW", thesis: "先進製程曝險" }],
    outcomes: [{ horizon_days: 30, excess_return: 8.25, outcome: "success" }],
    scoreComponents: [{ componentName: "companyActivity", normalizedScore: 80 }],
  });
  assert.equal(brief.lane, "semiconductor");
  assert.equal(brief.causalChain.length, 4);
  assert.match(brief.validationSummary.summary, /30 日/);
  assert.match(brief.validationSummary.summary, /\+8\.25%/);
  assert.ok(brief.invalidationConditions.some((item) => item.includes("訂單")));

  const biotech = buildSignalResearchBrief({
    signal: {
      ...signal,
      topic: "生技、醫療與新藥",
      hypothesis: "多個醫療議題正在升溫。",
      evidence: [{ source_count: 5, article_count: 11 }],
    },
    evidenceItems: [
      { sourceName: "A", sourceType: "news", knownAtSignalTime: true },
      { sourceName: "B", sourceType: "news", knownAtSignalTime: true },
      { sourceName: "C", sourceType: "news", knownAtSignalTime: true },
    ],
    watchlists: [],
    outcomes: [],
    scoreComponents: [],
  });
  assert.equal(biotech.lane, "biotech");
  assert.match(biotech.beneficiaryLogic, /不建立股票映射/);
  assert.ok(biotech.dataGaps.some((item) => item.includes("公司曝險")));
}

function testModelReplayFamilies() {
  assert.equal(normalizeSignalFamily("HBM / DRAM 記憶體供應鏈"), "memory");
  assert.equal(normalizeSignalFamily("國防、軍工與地緣風險"), "defense-geopolitics");
  assert.equal(normalizeSignalFamily("生技、醫療與新藥"), "biotech-health");
  assert.equal(normalizeSignalFamily("半導體與先進製程"), "semiconductor");
  assert.equal(normalizeSignalFamily("AI 資料中心電力與電網"), "power-grid");
}

function main() {
  testSignalScore();
  testTopicKeywordBoundaries();
  testVerifiedPriceGate();
  testCsvProvenance();
  testBacktestTimeBoundary();
  testSignalIdentityContinuity();
  testHeatLifecycle();
  testResearchBrief();
  testModelReplayFamilies();
  console.log("Signal research invariants: PASS");
}

main();
