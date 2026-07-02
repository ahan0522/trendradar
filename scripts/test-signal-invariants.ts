import assert from "node:assert/strict";
import {
  buildSignalScoreComponents,
  calculateSignalStrength,
  calculateSignalHeat,
  calculateResearchConfidence,
  calculateResearchConfidenceV2,
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
  isPlausibleBacktestReturn,
  isPlausibleBasketReturn,
  isValidBacktestWindow,
  SIGNAL_BACKTEST_HORIZONS,
} from "../lib/signals/backtest";
import {
  assessLatestPrice,
  publishableLatestPrice,
} from "../lib/signals/price-quality";
import {
  calculateReturn,
  isBacktestPriceUsable,
  parseStockPriceCsv,
} from "../lib/signals/stock-prices";
import {
  articleMatchesRule,
  textMatchesTopicKeyword,
} from "../lib/topic-grouping";
import { calculateHeatLifecycle } from "../lib/discovery/heat-lifecycle";
import { buildSignalResearchBrief } from "../lib/signals/research-brief";
import { normalizeSignalFamily } from "../lib/signals/model-replay";
import { buildReplayResearchReport } from "../lib/signals/replay-research-report";
import { normalizeReplayPriceSkipReason } from "../lib/signals/model-replay-price-backfill";
import { isReplayHorizonMature } from "../lib/signals/model-replay-backtest";
import { matchCorporateActionAdjustment } from "../lib/signals/corporate-actions";
import { isNonInvestableCandidateContent } from "../lib/signals/monthly-discovery";
import {
  buildLifecycleTransitions,
  signalContinuityKey,
} from "../lib/signals/signal-continuity";
import { buildSignalResearchSnapshot } from "../lib/signals/research-snapshot";
import {
  buildResearchConfidenceAssessment,
  RESEARCH_CONFIDENCE_ASSESSMENT_VERSION,
  researchConfidenceSnapshotVersion,
} from "../lib/signals/research-confidence-assessment";
import {
  canTransitionPublicationReview,
  evaluateSignalForPublication,
} from "../lib/signals/publication-review";
import {
  buildPublicationFeed,
  publicationPeriodKey,
} from "../lib/signals/publication-feed";
import { buildSignalEvidencePanel } from "../lib/signals/evidence-panel";
import {
  EVIDENCE_MATERIALIZATION_VERSION,
  researchEvidenceRelevance,
} from "../lib/signals/evidence-materialization";
import { mapBeneficiaries } from "../lib/signals/beneficiary-mapping";
import { classifyMonthCoverage } from "../lib/signals/data-coverage";
import {
  MONTHLY_DISCOVERY_MODEL_VERSION,
  RESEARCH_CONFIDENCE_MODEL_VERSION,
} from "../lib/signals/monthly-discovery";
import {
  dedupeArticlesByEvent,
  dedupeArticlesByEventWindow,
  dedupeArticlesByFingerprintWindow,
  normalizeArticleUrl,
  normalizeComparableText,
} from "../lib/article-dedupe";
import {
  taipeiDateForTimestamp,
  taipeiMonthForTimestamp,
  taipeiMonthStartIso,
  taipeiNextMonthStartIso,
} from "../lib/time/taipei";

function testSignalScore() {
  assert.equal(MONTHLY_DISCOVERY_MODEL_VERSION, "monthly-full-market-v3");
  assert.equal(RESEARCH_CONFIDENCE_MODEL_VERSION, "research-confidence-v3");
  assert.equal(EVIDENCE_MATERIALIZATION_VERSION, "evidence-v4");
  assert.equal(
    researchEvidenceRelevance(
      "具身 AI 機器人平台發表",
      "industry",
      "Semiconductor / Compute 高科技製造產能利用率",
    ),
    false,
  );
  assert.equal(
    researchEvidenceRelevance(
      "具身 AI 機器人平台發表",
      "industry",
      "工業機器人訂單與自動化設備出貨",
    ),
    true,
  );
  const confidenceVersion = researchConfidenceSnapshotVersion({
    evidenceIds: ["evidence-b", "evidence-a"],
    mappingSymbols: ["2330.TW", "NVDA"],
  });
  assert.equal(confidenceVersion, researchConfidenceSnapshotVersion({
    evidenceIds: ["evidence-a", "evidence-b"],
    mappingSymbols: ["NVDA", "2330.TW"],
  }));
  assert.notEqual(confidenceVersion, researchConfidenceSnapshotVersion({
    evidenceIds: ["evidence-a"],
    mappingSymbols: ["NVDA", "2330.TW"],
  }));
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
  assert.equal(calculateSignalHeat({
    mentionSpike: 100,
    velocity: 100,
    articleVolume: 100,
    sourceDiversity: 100,
    persistence: 100,
  }), 100);
  assert.equal(calculateResearchConfidence({
    sourceQuality: 100,
    sourceDiversity: 100,
    evidenceDepth: 100,
    persistence: 100,
    companyActivity: 100,
    beneficiaryClarity: 100,
    priceConfirmation: 100,
  }), 100);
  assert.equal(calculateResearchConfidence({
    sourceQuality: 100,
    contradictionPenalty: 100,
  }), 5);
  assert.equal(calculateResearchConfidenceV2({
    sourceQuality: 100,
    sourceDiversity: 100,
    industryEvidence: 100,
    commodityEvidence: 100,
    companyEvidence: 100,
    supplyChainEvidence: 100,
    beneficiaryClarity: 100,
    marketEvidence: 100,
    persistence: 100,
  }), 100);
  assert.equal(calculateResearchConfidenceV2({
    sourceQuality: 100,
    sourceDiversity: 100,
    persistence: 100,
  }), 20);
  assert.equal(calculateResearchConfidenceV2({
    sourceQuality: 100,
    sourceDiversity: 100,
    industryEvidence: 100,
    commodityEvidence: 100,
    companyEvidence: 100,
    supplyChainEvidence: 100,
    beneficiaryClarity: 100,
    marketEvidence: 100,
    persistence: 100,
    contradictionPenalty: 100,
  }), 70);
  assert.equal(calculateResearchConfidenceV2({
    sourceQuality: 100,
    sourceDiversity: 100,
    requiredEvidenceCoverage: 100,
    persistence: 100,
  }), 35);

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

function testBeneficiaryResearchMapping() {
  const memory = mapBeneficiaries({
    topic: "HBM 與 DRAM 記憶體需求",
    signalEventId: "memory-test",
  });
  assert.ok(memory.length > 0);
  assert.ok(memory.every((item) => item.directOperatingLink === true));
  assert.ok(memory.every((item) => Boolean(item.valueChainRole)));
  assert.ok(memory.every((item) => Boolean(item.causalReason)));
  assert.ok(memory.every((item) => (item.trackingMetrics?.length ?? 0) >= 3));
  assert.ok(memory.every((item) => (item.invalidationConditions?.length ?? 0) >= 3));
  const micron = memory.find((item) => item.symbol === "MU");
  const nanya = memory.find((item) => item.symbol === "2408.TW");
  const phison = memory.find((item) => item.symbol === "8299.TW");
  assert.equal(micron?.valueChainRole, "DRAM、NAND 與 HBM 製造");
  assert.equal(nanya?.valueChainRole, "標準型 DRAM 製造");
  assert.equal(phison?.valueChainRole, "NAND 控制晶片與儲存方案");
  assert.notEqual(micron?.causalReason, phison?.causalReason);
  assert.ok(phison?.trackingMetrics?.includes("企業級 SSD／儲存方案營收"));
  assert.equal(phison?.mappingVersion, "beneficiary-research-v2");
  assert.ok((phison?.mappingSources?.length ?? 0) > 0);
  const power = mapBeneficiaries({
    topic: "AI 資料中心電力與電網",
    hypothesis: "AI 資料中心擴建推升電力、變壓器與電網設備需求。",
    signalEventId: "power-test",
  });
  assert.ok(power.length > 0);
  assert.ok(power.every((item) => item.mappingVersion === "beneficiary-research-v2"));
  assert.ok(power.every((item) => (item.mappingSources?.length ?? 0) > 0));
  assert.equal(power.find((item) => item.symbol === "ETN")?.valueChainRole, "資料中心配電與電力管理設備");
  assert.equal(power.find((item) => item.symbol === "1519.TW")?.valueChainRole, "電力與配電變壓器、開關設備");
  assert.ok(power.every((item) => !item.trackingMetrics?.includes("GPU／加速器營收")));
  assert.deepEqual(mapBeneficiaries({
    topic: "與企業營運沒有直接關係的熱門娛樂新聞",
  }), []);
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
  const verifiedNanyaPrice = {
    ...verifiedPrice,
    priceDate: "2026-06-30",
    close: 452.5,
    adjClose: 452.5,
    provider: "twse-official+yahoo-chart",
    verificationProvider: "twse-official+yahoo-adjustment-v1",
  };
  assert.equal(
    assessLatestPrice("2408.TW", "TW", verifiedNanyaPrice, { asOfDate: "2026-06-30" }).status,
    "verified",
  );
  assert.equal(
    assessLatestPrice("2408.TW", "TW", {
      ...verifiedNanyaPrice,
      verificationProvider: "twse-official",
    }).status,
    "needs_review",
  );
  assert.equal(
    assessLatestPrice("2408.TW", "TW", {
      ...verifiedNanyaPrice,
      close: 700,
      adjClose: 700,
    }).status,
    "needs_review",
  );
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
  assert.equal(isBacktestPriceUsable(prices[0]), true);
  assert.equal(isBacktestPriceUsable({
    ...prices[0],
    symbol: "2408.TW",
    close: 449,
    adjClose: 449,
  }), false);
  assert.equal(isBacktestPriceUsable({
    ...prices[0],
    symbol: "2408.TW",
    priceDate: "2026-06-30",
    close: 452.5,
    adjClose: 452.5,
    provider: "twse-official+yahoo-chart",
    verificationProvider: "twse-official+yahoo-adjustment-v1",
  }), true);
  assert.equal(isBacktestPriceUsable({
    ...prices[0],
    provider: undefined,
  }), false);
}

function testBacktestTimeBoundary() {
  assert.deepEqual(SIGNAL_BACKTEST_HORIZONS, [7, 30, 60, 90]);
  assert.equal(asOfEndIso("2026-03-31"), "2026-03-31T15:59:59.999Z");
  assert.throws(() => asOfEndIso("2026/03/31"), /YYYY-MM-DD/);
  assert.throws(() => asOfEndIso("2026-02-31"), /Invalid asOfDate/);
  assert.doesNotThrow(() => assertAsOfNotFuture("2026-03-31", "2026-03-31"));
  assert.throws(() => assertAsOfNotFuture("2026-04-01", "2026-03-31"), /future/);
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(isHorizonMature("2026-06-01", 30, "2026-06-30"), false);
  assert.equal(isHorizonMature("2026-06-01", 30, "2026-07-01"), true);
  assert.equal(isReplayHorizonMature("2026-06-23", 7, "2026-06-30"), false);
  assert.equal(isReplayHorizonMature("2026-06-23", 7, "2026-07-01"), true);
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
  assert.equal(isPlausibleBacktestReturn(49, 7), true);
  assert.equal(isPlausibleBacktestReturn(51, 7), false);
  assert.equal(isPlausibleBacktestReturn(174, 60), true);
  assert.equal(isPlausibleBacktestReturn(176, 60), false);
  assert.equal(isPlausibleBacktestReturn(249, 90), true);
  assert.equal(isPlausibleBasketReturn(100), true);
  assert.equal(isPlausibleBasketReturn(100.01), false);
}

function testMonthCoverageStatus() {
  const base = {
    articleCount: 0,
    effectiveSourceCount: 0,
    stockPriceCount: 0,
    marketPriceSeriesCount: 0,
    industryObservationCount: 0,
    commodityQuoteCount: 0,
    companyActionCount: 0,
  };
  assert.equal(classifyMonthCoverage(base).code, "backfill_required");
  assert.equal(classifyMonthCoverage({
    ...base,
    articleCount: 8,
    effectiveSourceCount: 4,
  }).code, "discovery_limited");
  assert.equal(classifyMonthCoverage({
    ...base,
    articleCount: 30,
    effectiveSourceCount: 6,
  }).code, "discovery_ready");
  assert.equal(classifyMonthCoverage({
    ...base,
    articleCount: 30,
    effectiveSourceCount: 6,
    stockPriceCount: 50,
  }).code, "validation_ready");
  assert.equal(classifyMonthCoverage({
    ...base,
    articleCount: 30,
    effectiveSourceCount: 6,
    stockPriceCount: 50,
    companyActionCount: 2,
  }).code, "multi_evidence_ready");
}

function testMonthlyCandidateGuard() {
  const monthCount = (startMonth: string, endMonth: string) => {
    const start = new Date(`${startMonth}-01T00:00:00Z`);
    const end = new Date(`${endMonth}-01T00:00:00Z`);
    return (
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      end.getUTCMonth() -
      start.getUTCMonth() +
      1
    );
  };
  assert.equal(monthCount("2026-06", "2026-06"), 1);
  assert.equal(monthCount("2025-01", "2026-06"), 18);
}

function testArticleEventDedupe() {
  assert.equal(
    normalizeArticleUrl("https://EXAMPLE.com/news/?utm_source=test&b=2&a=1#section"),
    "https://example.com/news?a=1&b=2",
  );
  assert.equal(
    normalizeComparableText("AI 伺服器需求升溫 - 中央社"),
    normalizeComparableText("AI 伺服器需求升溫 | 自由時報"),
  );
  const articles = dedupeArticlesByEvent([
    {
      title: "AI 伺服器需求升溫 - 中央社",
      sourceName: "中央社",
      link: "https://example.com/a?utm_source=feed",
      publishedAt: "2026-06-28T01:00:00Z",
    },
    {
      title: "AI 伺服器需求升溫 | 自由時報",
      sourceName: "自由時報",
      link: "https://example.com/b",
      publishedAt: "2026-06-28T02:00:00Z",
    },
    {
      title: "另一則完全不同的市場新聞",
      sourceName: "中央社",
      link: "https://example.com/c",
      publishedAt: "2026-06-28T03:00:00Z",
    },
  ]);
  assert.equal(articles.length, 2);
  assert.equal(articles[0].title, "另一則完全不同的市場新聞");
  assert.equal(
    dedupeArticlesByEventWindow([
      {
        title: "同一事件",
        sourceName: "中央社",
        publishedAt: "2026-06-28T15:30:00Z",
      },
      {
        title: "同一事件",
        sourceName: "自由時報",
        publishedAt: "2026-06-28T16:30:00Z",
      },
    ]).length,
    2,
  );
  assert.equal(
    dedupeArticlesByFingerprintWindow([
      {
        title: "同一事件 - 中央社",
        sourceName: "中央社",
        publishedAt: "2026-06-28T01:00:00Z",
      },
      {
        title: "同一事件 | 自由時報",
        sourceName: "自由時報",
        publishedAt: "2026-06-28T02:00:00Z",
      },
    ]).length,
    1,
  );
}

function testTaipeiMonthBoundary() {
  assert.equal(taipeiMonthStartIso("2026-05"), "2026-05-01T00:00:00+08:00");
  assert.equal(taipeiNextMonthStartIso("2026-05-31"), "2026-06-01T00:00:00+08:00");
  assert.equal(taipeiMonthForTimestamp("2026-05-31T15:59:59.999Z"), "2026-05");
  assert.equal(taipeiMonthForTimestamp("2026-05-31T16:00:00.000Z"), "2026-06");
  assert.equal(taipeiDateForTimestamp("2026-05-31T16:00:00.000Z"), "2026-06-01");
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
  assert.equal(sustained.state, "sustained");
  assert.ok(sustained.persistenceScore >= 70);

  const rising = calculateHeatLifecycle({
    asOfDate: "2026-06-28",
    sourceCount: 3,
    publishedAt: [
      "2026-06-28T02:00:00.000Z",
      "2026-06-28T06:00:00.000Z",
      "2026-06-28T10:00:00.000Z",
    ],
  });
  assert.equal(rising.state, "rising");

  const cooling = calculateHeatLifecycle({
    asOfDate: "2026-06-28",
    sourceCount: 4,
    publishedAt: articleDates([
      "2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18",
      "2026-06-19", "2026-06-20", "2026-06-27",
    ]),
  });
  assert.equal(cooling.state, "cooling");

  const reactivated = calculateHeatLifecycle({
    asOfDate: "2026-06-28",
    sourceCount: 3,
    publishedAt: articleDates([
      "2026-04-01", "2026-04-05", "2026-04-12",
      "2026-06-25", "2026-06-27", "2026-06-28",
    ]),
  });
  assert.equal(reactivated.state, "reactivated");

  const expired = calculateHeatLifecycle({
    asOfDate: "2026-06-28",
    sourceCount: 2,
    publishedAt: articleDates(["2026-04-01", "2026-04-05", "2026-04-12"]),
  });
  assert.equal(expired.state, "expired");
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
  assert.ok(brief.evidenceCoverage);

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

  const memory = buildSignalResearchBrief({
    signal: {
      ...signal,
      topic: "HBM / DRAM 記憶體供應鏈",
      hypothesis: "HBM 需求推動 DRAM 產能重新配置。",
      evidence: [{ source_count: 3, article_count: 10 }],
    },
    evidenceItems: [
      { sourceName: "FRED", sourceType: "industry", title: "Memory capacity utilization improves", knownAtSignalTime: true },
    ],
    watchlists: [],
    outcomes: [],
    scoreComponents: [],
  });
  assert.deepEqual(memory.evidenceCoverage?.families, ["memory"]);
  assert.equal(memory.evidenceCoverage?.totalRequiredCount, 2);
  assert.equal(memory.evidenceCoverage?.satisfiedRequiredCount, 1);
  assert.ok(memory.dataGaps.some((item) => item.includes("DRAM / NAND / HBM")));
}

function testModelReplayFamilies() {
  assert.equal(normalizeSignalFamily("HBM / DRAM 記憶體供應鏈"), "memory");
  assert.equal(normalizeSignalFamily("國防、軍工與地緣風險"), "defense-geopolitics");
  assert.equal(normalizeSignalFamily("生技、醫療與新藥"), "biotech-health");
  assert.equal(normalizeSignalFamily("半導體與先進製程"), "semiconductor");
  assert.equal(normalizeSignalFamily("AI 資料中心電力與電網"), "power-grid");
}

function testReplayResearchReport() {
  const modelPerformance = {
    signalCount: 30,
    mappedCount: 24,
    testedCount: 22,
    averageThirtyDayExcessReturn: 8,
    thirtyDaySuccessRate: 0.5,
  };
  const report = buildReplayResearchReport({
    id: "run-1",
    startMonth: "2025-01",
    endMonth: "2025-12",
    baselineModelVersion: "monthly-signal-v2",
    candidateModelVersion: "monthly-full-market-v1",
    summary: { coverageBreadthLift: 0.52 },
    months: [],
  }, {
    summary: {
      signalCount: 60,
      mappedCount: 48,
      testedCount: 44,
      unmappedCount: 12,
      missingPriceCount: 4,
      thirtyDayTestCount: 44,
      baseline: modelPerformance,
      candidate: { ...modelPerformance, averageThirtyDayExcessReturn: 8.4 },
    },
    results: [],
  });
  assert.equal(report.verdict, "comparable");
  assert.match(report.executiveSummary, /52%/);
  assert.equal(report.dataQuality.completeThirtyDaySamples, 44);
  assert.ok(report.diagnostics.recommendations.some((item) => item.includes("缺少完整驗證價格")));
  assert.deepEqual(report.diagnostics.confidenceCalibration, []);
  assert.deepEqual(report.diagnostics.dataGapsByFamily, []);
}

function testReplayHorizonMaturity() {
  assert.equal(isReplayHorizonMature("2026-03-31", 90, "2026-06-29"), false);
  assert.equal(isReplayHorizonMature("2026-03-31", 90, "2026-06-30"), true);
}

function testReplayPriceSkipReasonClassification() {
  assert.equal(
    normalizeReplayPriceSkipReason("Cross-source adjusted close gap: official 538, Yahoo 489.09, gap 9.09%. Treat as pending corporate-action adjustment review."),
    "corporate_action_adjustment_gap",
  );
  assert.equal(
    normalizeReplayPriceSkipReason("Cross-source close mismatch: official 538, Yahoo 400, gap 25.65%."),
    "cross_source_close_mismatch",
  );
  assert.equal(
    normalizeReplayPriceSkipReason("價格 649692 超出合理區間 50000-600000，需重新驗證資料來源"),
    "sanity_range_above_max",
  );
  assert.equal(
    normalizeReplayPriceSkipReason("價格 8.5 超出合理區間 10-180，需重新驗證資料來源"),
    "sanity_range_below_min",
  );
}

function testCorporateActionAdjustmentRegistry() {
  const matched = matchCorporateActionAdjustment({
    symbol: "1519.TW",
    market: "TW",
    priceDate: "2025-06-30",
    officialClose: 563,
    adjustedClose: 511.81817626953125,
  });
  assert.ok(matched);
  assert.equal(matched.exDate, "2025-07-25");
  assert.equal(matched.adjustmentFactor, 1.1);
  assert.equal(matchCorporateActionAdjustment({
    symbol: "1519.TW",
    market: "TW",
    priceDate: "2025-07-25",
    officialClose: 591,
    adjustedClose: 537.27,
  }), null);
  assert.equal(matchCorporateActionAdjustment({
    symbol: "2408.TW",
    market: "TW",
    priceDate: "2025-06-30",
    officialClose: 563,
    adjustedClose: 511.81817626953125,
  }), null);
}

function testMonthlyDiscoveryInvestabilityFilter() {
  assert.equal(isNonInvestableCandidateContent({
    title: "MLB 大谷翔平與投手戰況",
    articleTitles: ["MLB 李灝宇敲雙安", "洋基投手本季表現", "道奇今日賽況"],
  }), true);
  assert.equal(isNonInvestableCandidateContent({
    title: "AI 資料中心能源需求",
    articleTitles: ["資料中心電力需求攀升", "AI 伺服器帶動電網建設", "球隊採用 AI 分析系統"],
  }), false);
}

function testCrossMonthSignalLifecycle() {
  assert.equal(signalContinuityKey("2026-06 記憶體供需循環"), "memory");
  const cooling = buildLifecycleTransitions([], [{
    continuityKey: "memory",
    signalEventId: "may-memory",
    asOfDate: "2026-05-31",
    lastSeenAsOf: "2026-05-31",
    lifecycleState: "sustained",
  }], "2026-06-30");
  assert.equal(cooling[0].lifecycleState, "cooling");
  assert.equal(cooling[0].lastSeenAsOf, "2026-05-31");

  const expired = buildLifecycleTransitions([], [{
    ...cooling[0],
    asOfDate: "2026-06-30",
  }], "2026-07-31");
  assert.equal(expired[0].lifecycleState, "expired");

  const reactivated = buildLifecycleTransitions([{
    signalEventId: "aug-memory",
    topic: "2026-08 記憶體供需循環",
    asOfDate: "2026-08-31",
    lifecycleState: "rising",
    lifecycleReason: "本月重新升溫。",
  }], [{
    ...expired[0],
    asOfDate: "2026-07-31",
  }], "2026-08-31");
  assert.equal(reactivated[0].lifecycleState, "reactivated");
  assert.equal(reactivated[0].continuityKey, "memory");
}

function testSignalResearchSnapshotContract() {
  const snapshot = buildSignalResearchSnapshot({
    signalEventId: "memory-2026-06",
    asOfDate: "2026-06-30",
    topic: "2026-06 記憶體供需循環",
    hypothesis: "需求與產能配置可能改變。",
    heatScore: 72,
    heatState: "sustained",
    heatReason: "跨來源持續討論。",
    confidenceScore: 48,
    confidenceModelVersion: "research-confidence-v3",
    evidence: [
      {
        id: "support",
        sourceType: "official",
        title: "供應商擴充 HBM 產能",
        evidenceDate: "2026-06-20",
        knownAtSignalTime: true,
      },
      {
        id: "counter",
        sourceType: "company_action",
        title: "分析師示警需求見頂並出現供應鏈隱憂",
        evidenceDate: "2026-06-25",
        knownAtSignalTime: true,
      },
      {
        id: "future",
        sourceType: "official",
        title: "未來資訊",
        evidenceDate: "2026-07-01",
        knownAtSignalTime: true,
      },
    ],
    watchlists: [{
      symbol: "2408.TW",
      trackingMetrics: ["DRAM 合約價"],
      invalidationConditions: ["庫存持續上升"],
    }],
  });
  assert.equal(snapshot.heat.score, 72);
  assert.equal(snapshot.researchConfidence.score, 48);
  assert.equal(snapshot.validation.status, "pending");
  assert.equal(snapshot.outcome, null);
  assert.deepEqual(snapshot.supportingEvidence.map((item) => item.id), ["support"]);
  assert.deepEqual(snapshot.counterEvidence.map((item) => item.id), ["counter"]);
  assert.deepEqual(snapshot.validation.conditions, ["DRAM 合約價"]);
  assert.deepEqual(snapshot.invalidationConditions, ["庫存持續上升"]);
}

function testEvidenceBasedResearchConfidence() {
  const mappings = [{
    symbol: "MU",
    directOperatingLink: true,
    mappingSources: ["https://www.micron.com/products/memory"],
    trackingMetrics: ["DRAM 報價"],
    invalidationConditions: ["庫存上升"],
  }];
  const newsOnly = buildResearchConfidenceAssessment({
    topic: "HBM / DRAM 記憶體供需循環",
    evidence: [{
      id: "news",
      sourceType: "news",
      title: "記憶體新聞熱度升高",
      sourceName: "News",
      knownAtSignalTime: true,
    }],
    mappings,
    persistenceScore: 60,
  });
  const verifiedEvidence = buildResearchConfidenceAssessment({
    topic: "HBM / DRAM 記憶體供需循環",
    evidence: [
      {
        id: "price",
        sourceType: "commodity",
        title: "DRAM contract price rises",
        sourceName: "verified-pricing",
        knownAtSignalTime: true,
        sourceReliability: 95,
      },
      {
        id: "supply",
        sourceType: "industry",
        title: "Memory capacity utilization improves",
        sourceName: "verified-industry",
        knownAtSignalTime: true,
        sourceReliability: 90,
      },
    ],
    mappings,
    persistenceScore: 60,
  });
  assert.equal(newsOnly.modelVersion, RESEARCH_CONFIDENCE_ASSESSMENT_VERSION);
  assert.equal(newsOnly.coverage.satisfiedRequiredCount, 0);
  assert.ok(newsOnly.dataGaps.length >= 2);
  assert.equal(verifiedEvidence.coverage.satisfiedRequiredCount, 2);
  assert.ok(verifiedEvidence.score > newsOnly.score);
}

function testPublicationGate() {
  assert.equal(canTransitionPublicationReview("draft", "reviewed"), true);
  assert.equal(canTransitionPublicationReview("draft", "approved"), false);
  assert.equal(canTransitionPublicationReview("reviewed", "approved"), true);
  assert.equal(canTransitionPublicationReview("approved", "published"), true);
  assert.equal(canTransitionPublicationReview("published", "draft"), false);
  assert.equal(canTransitionPublicationReview("rejected", "draft"), true);

  const eligible = evaluateSignalForPublication({
    signal: {
      id: "signal-1",
      asOfDate: "2026-06-28",
      topic: "2026-06 記憶體供需循環",
      signalStrength: 72,
      confidenceScore: 68,
      hypothesis: "記憶體產能配置與需求正在改變。",
      evidence: [{ source_count: 5, event_count: 12 }],
    },
    watchlists: [{
      symbol: "MU",
      companyName: "Micron",
      market: "US",
      thesis: "直接生產 DRAM 與 HBM，可用報價、庫存與毛利率驗證假設。",
      causalReason: "Micron 直接生產 DRAM 與 HBM，需求及報價會影響營收與毛利。",
      trackingMetrics: ["DRAM 報價", "HBM 出貨", "庫存"],
      invalidationConditions: ["報價轉跌", "庫存上升", "HBM 出貨不如預期"],
      directOperatingLink: true,
    }],
    evidenceItems: [
      { sourceName: "A", sourceType: "news", knownAtSignalTime: true },
      { sourceName: "B", sourceType: "commodity", title: "DRAM 報價連續上調", knownAtSignalTime: true },
      { sourceName: "C", sourceType: "industry", title: "記憶體產能利用率與庫存改善", knownAtSignalTime: true },
      { sourceName: "D", sourceType: "company_action", knownAtSignalTime: true },
    ],
    outcomes: [],
    scoreComponents: [],
  });
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.publishingBrief.attentionDirections[0].symbol, "MU");
  assert.ok(eligible.qualityScore >= 90);

  const missingRequiredEvidence = evaluateSignalForPublication({
    signal: {
      id: "signal-missing-evidence",
      asOfDate: "2026-06-28",
      topic: "2026-06 HBM / DRAM 記憶體供需循環",
      signalStrength: 78,
      confidenceScore: 74,
      hypothesis: "HBM 需求推動 DRAM 產能重新配置。",
      evidence: [{ source_count: 5, event_count: 12 }],
    },
    watchlists: [{
      symbol: "MU",
      companyName: "Micron",
      market: "US",
      thesis: "直接生產 DRAM 與 HBM，可用報價、庫存與毛利率驗證假設。",
      causalReason: "Micron 直接生產 DRAM 與 HBM，需求及報價會影響營收與毛利。",
      trackingMetrics: ["DRAM 報價", "HBM 出貨", "庫存"],
      invalidationConditions: ["報價轉跌", "庫存上升", "HBM 出貨不如預期"],
      directOperatingLink: true,
    }],
    evidenceItems: [
      { sourceName: "A", sourceType: "news", title: "記憶體題材新聞升溫", knownAtSignalTime: true },
      { sourceName: "B", sourceType: "news", title: "AI 伺服器帶動記憶體討論", knownAtSignalTime: true },
      { sourceName: "C", sourceType: "company_action", title: "Micron 財測更新", knownAtSignalTime: true },
    ],
    outcomes: [],
    scoreComponents: [],
  });
  const requiredCoverageGate = missingRequiredEvidence.gates.find((item) => item.key === "required_evidence_coverage");
  assert.equal(missingRequiredEvidence.eligible, false);
  assert.equal(requiredCoverageGate?.required, true);
  assert.equal(requiredCoverageGate?.passed, false);

  const rejected = evaluateSignalForPublication({
    signal: {
      id: "signal-2",
      asOfDate: "2026-06-28",
      topic: "單一新聞事件",
      signalStrength: 40,
      confidenceScore: 30,
      hypothesis: "資料不足。",
      evidence: [{ source_count: 1, event_count: 1 }],
    },
    watchlists: [],
    evidenceItems: [{ sourceName: "A", sourceType: "news", knownAtSignalTime: true }],
    outcomes: [],
    scoreComponents: [],
  });
  assert.equal(rejected.eligible, false);
  assert.ok(rejected.gates.filter((item) => item.required && !item.passed).length >= 4);
}

function testPublicationFeed() {
  const brief = {
    signalEventId: "signal-a",
    asOfDate: "2026-06-28",
    headline: "AI 電力基礎建設",
    whyItMatters: "資料中心擴建推升電力設備需求。",
    evidenceSummary: "已通過內部證據檢查。",
    attentionDirections: [],
    trackingIndicators: ["變壓器訂單"],
    invalidationConditions: ["訂單轉弱"],
    validationSummary: "等待 30 日驗證。",
    disclosure: "不構成買賣建議。",
  };
  const rows = [
    { id: "draft", signal_event_id: "signal-a", version: 1, status: "draft" as const, quality_score: 70, publishing_brief: brief, created_at: "2026-06-28T01:00:00Z" },
    { id: "published-old", signal_event_id: "signal-b", version: 1, status: "published" as const, quality_score: 80, publishing_brief: { ...brief, signalEventId: "signal-b" }, created_at: "2026-06-28T02:00:00Z" },
    { id: "approved", signal_event_id: "signal-c", version: 2, status: "approved" as const, quality_score: 90, publishing_brief: { ...brief, signalEventId: "signal-c" }, created_at: "2026-06-28T03:00:00Z" },
  ];
  const publicFeed = buildPublicationFeed(rows, { period: "monthly" });
  assert.equal(publicFeed.itemCount, 1);
  assert.equal(publicFeed.periods[0].items[0].status, "published");
  const previewFeed = buildPublicationFeed(rows, { period: "monthly", includeApproved: true });
  assert.equal(previewFeed.itemCount, 2);
  assert.equal(publicationPeriodKey("2026-06-28", "daily"), "2026-06-28");
  assert.equal(publicationPeriodKey("2026-06-28", "weekly"), "2026-W26");
  assert.equal(publicationPeriodKey("2026-06-28", "monthly"), "2026-06");
}

function testEvidencePanel() {
  const panel = buildSignalEvidencePanel({
    evidenceItems: [
      { sourceType: "news", sourceName: "A", knownAtSignalTime: true },
      { sourceType: "news", sourceName: "B", knownAtSignalTime: true },
      { sourceType: "news", sourceName: "C", knownAtSignalTime: true },
      { sourceType: "company_action", sourceName: "SEC", knownAtSignalTime: true },
      { sourceType: "commodity", title: "DRAM 報價", knownAtSignalTime: false },
    ],
    scoreComponents: [{ componentName: "priceSpike", normalizedScore: 72 }],
    outcomes: [],
  });
  assert.equal(panel.find((item) => item.category === "news")?.status, "partial");
  assert.equal(panel.find((item) => item.category === "company")?.evidenceCount, 1);
  assert.equal(panel.find((item) => item.category === "commodity")?.status, "missing");
  assert.equal(panel.find((item) => item.category === "market")?.status, "confirmed");
}

function main() {
  testSignalScore();
  testBeneficiaryResearchMapping();
  testTopicKeywordBoundaries();
  testVerifiedPriceGate();
  testCsvProvenance();
  testBacktestTimeBoundary();
  testMonthCoverageStatus();
  testMonthlyCandidateGuard();
  testArticleEventDedupe();
  testTaipeiMonthBoundary();
  testSignalIdentityContinuity();
  testHeatLifecycle();
  testResearchBrief();
  testModelReplayFamilies();
  testReplayResearchReport();
  testReplayHorizonMaturity();
  testReplayPriceSkipReasonClassification();
  testCorporateActionAdjustmentRegistry();
  testMonthlyDiscoveryInvestabilityFilter();
  testCrossMonthSignalLifecycle();
  testSignalResearchSnapshotContract();
  testEvidenceBasedResearchConfidence();
  testPublicationGate();
  testPublicationFeed();
  testEvidencePanel();
  console.log("Signal research invariants: PASS");
}

main();
