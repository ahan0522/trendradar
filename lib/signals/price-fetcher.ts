import type { MarketCode, StockPrice } from "@/types/signals";
import { upsertStockPrices } from "@/lib/signals/stock-prices";
import { assessLatestPrice } from "@/lib/signals/price-quality";
import { matchCorporateActionAdjustment } from "@/lib/signals/corporate-actions";
import {
  crossVerifyUsPrice,
  fetchAlphaVantageDailySeries,
} from "@/lib/signals/us-price-verification";

export type PriceSourceProvider = "twse" | "tpex" | "yahoo_chart" | "manual_required";

export type StockPriceFetchRequest = {
  symbol: string;
  market: MarketCode;
  date: string;
};

export type StockPriceFetchResult = {
  symbol: string;
  market: MarketCode;
  requestedDate: string;
  provider: PriceSourceProvider;
  status: "fetched" | "skipped" | "error";
  price: StockPrice | null;
  warnings: string[];
  errors: string[];
};

type TwseStockDayResponse = {
  stat?: string;
  date?: string;
  title?: string;
  data?: string[][];
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        exchangeName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
        adjclose?: Array<{
          adjclose?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
};

type TpexTradingStockResponse = {
  tables?: Array<{
    data?: string[][];
  }>;
};

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function toTwseQueryDate(date: string) {
  return date.replaceAll("-", "");
}

function parseTwseNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").replace(/\+/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTwseRocDate(value: string) {
  const [rocYear, month, day] = value.split("/").map((part) => Number(part));
  if (!rocYear || !month || !day) return null;
  const year = rocYear + 1911;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseTpexDate(value: string) {
  return parseTwseRocDate(value);
}

async function fetchTpexPrice(
  symbol: string,
  requestedDate: string,
  direction: "after" | "before",
  rangeDays: number,
): Promise<StockPriceFetchResult> {
  const stockNo = stockNoFromTwSymbol(symbol);
  const warnings: string[] = [];
  const errors: string[] = [];
  const edgeDate = addDays(requestedDate, direction === "after" ? rangeDays : -rangeDays);
  const monthStarts = new Set([`${requestedDate.slice(0, 8)}01`, `${edgeDate.slice(0, 8)}01`]);
  const candidates: StockPrice[] = [];

  for (const monthStart of monthStarts) {
    const queryDate = monthStart.replaceAll("-", "%2F");
    const url = `https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock?code=${encodeURIComponent(stockNo)}&date=${queryDate}&id=&response=json`;
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "TrendRadar/1.0 stock price validation",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      warnings.push(`TPEx request failed for ${stockNo} ${monthStart}: HTTP ${response.status}`);
      continue;
    }
    const payload = (await response.json()) as TpexTradingStockResponse;
    const rows = payload.tables?.[0]?.data ?? [];
    for (const row of rows) {
      const priceDate = parseTpexDate(row[0]);
      const close = parseTwseNumber(row[6]);
      if (!priceDate || close === null) continue;
      if (direction === "after" && (priceDate < requestedDate || priceDate > edgeDate)) continue;
      if (direction === "before" && (priceDate > requestedDate || priceDate < edgeDate)) continue;
      candidates.push({
        symbol: normalizeSymbol(symbol),
        market: "TW",
        priceDate,
        close,
        adjClose: close,
        provider: "tpex-official",
        sourceUrl: url,
        fetchedAt: new Date().toISOString(),
        qualityStatus: "verified",
        verificationProvider: "tpex-official",
      });
    }
  }

  candidates.sort((a, b) =>
    direction === "after"
      ? a.priceDate.localeCompare(b.priceDate)
      : b.priceDate.localeCompare(a.priceDate),
  );
  const price = candidates[0] ?? null;
  if (!price) {
    return {
      symbol: normalizeSymbol(symbol),
      market: "TW",
      requestedDate,
      provider: "tpex",
      status: "skipped",
      price: null,
      warnings,
      errors: [`No TPEx price found for ${symbol} ${direction === "after" ? "on or after" : "on or before"} ${requestedDate}.`],
    };
  }

  if (direction === "after") validateFetchedPriceOnOrAfter(price, requestedDate, warnings, errors);
  else validateFetchedPrice(price, requestedDate, warnings, errors);
  return {
    symbol: normalizeSymbol(symbol),
    market: "TW",
    requestedDate,
    provider: "tpex",
    status: errors.length > 0 ? "error" : "fetched",
    price: errors.length > 0 ? null : price,
    warnings,
    errors,
  };
}

function stockNoFromTwSymbol(symbol: string) {
  return normalizeSymbol(symbol).replace(".TW", "").replace(".TWO", "");
}

function yahooExpectedCurrency(market: MarketCode) {
  if (market === "US") return "USD";
  if (market === "TW") return "TWD";
  if (market === "KR") return "KRW";
  if (market === "JP") return "JPY";
  return null;
}

function yahooPeriod(date: string, offsetDays: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return Math.floor(value.getTime() / 1000);
}

async function fetchYahooPrice(
  providerSymbol: string,
  market: MarketCode,
  requestedDate: string,
  direction: "after" | "before",
  rangeDays: number,
  outputSymbol = providerSymbol,
  skipSanityCheck = false,
): Promise<StockPriceFetchResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const period1 = direction === "after"
    ? yahooPeriod(requestedDate, -1)
    : yahooPeriod(requestedDate, -rangeDays - 1);
  const period2 = direction === "after"
    ? yahooPeriod(requestedDate, rangeDays + 2)
    : yahooPeriod(requestedDate, 2);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "TrendRadar/1.0 historical price validation",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      symbol: outputSymbol,
      market,
      requestedDate,
      provider: "yahoo_chart",
      status: "error",
      price: null,
      warnings,
      errors: [`Yahoo chart request failed: HTTP ${response.status}`],
    };
  }

  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  if (!result) {
    return {
      symbol: outputSymbol,
      market,
      requestedDate,
      provider: "yahoo_chart",
      status: "skipped",
      price: null,
      warnings,
      errors: [payload.chart?.error?.description ?? "Yahoo chart returned no price data."],
    };
  }

  if (normalizeSymbol(result.meta?.symbol ?? "") !== providerSymbol) {
    errors.push(`Provider symbol mismatch: expected ${providerSymbol}, received ${result.meta?.symbol ?? "unknown"}`);
  }
  const expectedCurrency = yahooExpectedCurrency(market);
  if (expectedCurrency && result.meta?.currency !== expectedCurrency) {
    errors.push(`Provider currency mismatch: expected ${expectedCurrency}, received ${result.meta?.currency ?? "unknown"}`);
  }

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const volumes = result.indicators?.quote?.[0]?.volume ?? [];
  const candidates: StockPrice[] = [];

  for (let index = 0; index < timestamps.length; index += 1) {
    const close = closes[index];
    if (close === null || close === undefined || !Number.isFinite(close) || close <= 0) continue;
    const priceDate = new Date(timestamps[index] * 1000).toISOString().slice(0, 10);
    if (direction === "after" && priceDate < requestedDate) continue;
    if (direction === "before" && priceDate > requestedDate) continue;
    const adjClose = adjusted[index];
    const volume = volumes[index];
    candidates.push({
      symbol: outputSymbol,
      market,
      priceDate,
      close,
      adjClose: adjClose !== null && adjClose !== undefined && adjClose > 0 ? adjClose : close,
      volume: volume !== null && volume !== undefined && volume >= 0 ? volume : undefined,
      provider: "yahoo-chart",
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      qualityStatus: "verified",
      verificationProvider: "yahoo-chart-structural-v1",
    });
  }

  candidates.sort((a, b) =>
    direction === "after"
      ? a.priceDate.localeCompare(b.priceDate)
      : b.priceDate.localeCompare(a.priceDate),
  );
  const price = candidates[0] ?? null;
  if (!price) {
    return {
      symbol: outputSymbol,
      market,
      requestedDate,
      provider: "yahoo_chart",
      status: "skipped",
      price: null,
      warnings,
      errors: [`No ${market} price found ${direction === "after" ? "on or after" : "on or before"} ${requestedDate}.`],
    };
  }

  if (direction === "after") validateFetchedPriceOnOrAfter(price, requestedDate, warnings, errors);
  else validateFetchedPrice(price, requestedDate, warnings, errors);

  if (price.adjClose && Math.abs(price.adjClose / price.close - 1) > 0.5) {
    warnings.push("Adjusted close differs from close by more than 50%; retained for split/dividend adjustment review.");
  }

  if (!skipSanityCheck) {
    const quality = assessLatestPrice(outputSymbol, market, {
      priceDate: price.priceDate,
      close: price.close,
      adjClose: price.adjClose ?? null,
      volume: price.volume ?? null,
      qualityStatus: price.qualityStatus,
      provider: price.provider,
      sourceUrl: price.sourceUrl,
      verificationProvider: price.verificationProvider,
    });
    if (quality.status !== "verified") {
      errors.push(quality.reason ?? "Price failed sanity validation.");
    }
  }

  return {
    symbol: outputSymbol,
    market,
    requestedDate,
    provider: "yahoo_chart",
    status: errors.length > 0 ? "error" : "fetched",
    price: errors.length > 0 ? null : price,
    warnings,
    errors,
  };
}

export async function fetchProvisionalUsPriceOnOrBefore(
  request: StockPriceFetchRequest,
  lookbackDays = 10,
): Promise<StockPriceFetchResult> {
  const symbol = normalizeSymbol(request.symbol);
  const date = request.date.trim();
  if (request.market !== "US" || !isIsoDate(date)) {
    return {
      symbol,
      market: request.market,
      requestedDate: date,
      provider: "manual_required",
      status: "error",
      price: null,
      warnings: [],
      errors: ["Provisional Yahoo report prices require a US symbol and YYYY-MM-DD date."],
    };
  }

  const result = await fetchYahooPrice(symbol, "US", date, "before", lookbackDays, symbol, true);
  if (!result.price) return result;
  return {
    ...result,
    price: {
      ...result.price,
      qualityStatus: "unverified",
      verificationProvider: "yahoo-chart-single-source-report-v1",
    },
    warnings: [
      ...result.warnings,
      "Single-source Yahoo close is for market-brief display only and is excluded from backtests.",
    ],
  };
}

const alphaVantageSeriesCache = new Map<
  string,
  ReturnType<typeof fetchAlphaVantageDailySeries>
>();

async function fetchCrossVerifiedUsPrice(
  symbol: string,
  requestedDate: string,
  direction: "after" | "before",
  rangeDays: number,
): Promise<StockPriceFetchResult> {
  const yahoo = await fetchYahooPrice(
    symbol,
    "US",
    requestedDate,
    direction,
    rangeDays,
    symbol,
    true,
  );
  if (!yahoo.price) return yahoo;

  const normalizedSymbol = normalizeSymbol(symbol);
  let independentPromise = alphaVantageSeriesCache.get(normalizedSymbol);
  if (!independentPromise) {
    independentPromise = fetchAlphaVantageDailySeries(normalizedSymbol);
    alphaVantageSeriesCache.set(normalizedSymbol, independentPromise);
  }
  const independent = await independentPromise;
  if (independent.error) {
    return {
      ...yahoo,
      status: "skipped",
      price: null,
      errors: [...yahoo.errors, independent.error],
    };
  }

  const secondSource = independent.prices.get(yahoo.price.priceDate);
  const verified = secondSource
    ? crossVerifyUsPrice(yahoo.price, secondSource)
    : null;
  if (!verified) {
    return {
      ...yahoo,
      status: "skipped",
      price: null,
      errors: [
        ...yahoo.errors,
        secondSource
          ? "US cross-source close difference exceeded 1%."
          : `Independent source has no exact-date close for ${yahoo.price.priceDate}.`,
      ],
    };
  }

  const quality = assessLatestPrice(normalizedSymbol, "US", {
    priceDate: verified.priceDate,
    close: verified.close,
    adjClose: verified.adjClose ?? null,
    volume: verified.volume ?? null,
    qualityStatus: verified.qualityStatus,
    provider: verified.provider,
    sourceUrl: verified.sourceUrl,
    verificationProvider: verified.verificationProvider,
  });
  return {
    ...yahoo,
    status: quality.status === "verified" ? "fetched" : "error",
    price: quality.status === "verified" ? verified : null,
    errors: quality.status === "verified"
      ? yahoo.errors
      : [...yahoo.errors, quality.reason ?? "US cross-verified price failed final validation."],
  };
}

async function verifyTwPriceAdjustment(
  official: StockPriceFetchResult,
  requestedDate: string,
  direction: "after" | "before",
  rangeDays: number,
  providerSymbol: string,
): Promise<StockPriceFetchResult> {
  if (!official.price) return official;

  const adjusted = await fetchYahooPrice(
    providerSymbol,
    "TW",
    requestedDate,
    direction,
    rangeDays,
    official.symbol,
    true,
  );
  if (!adjusted.price) {
    return {
      ...official,
      status: "skipped",
      price: null,
      warnings: [...official.warnings, ...adjusted.warnings],
      errors: [
        ...official.errors,
        ...adjusted.errors,
        "Official close could not be paired with an adjusted close.",
      ],
    };
  }

  if (adjusted.price.priceDate !== official.price.priceDate) {
    return {
      ...official,
      status: "error",
      price: null,
      errors: [
        ...official.errors,
        `Cross-source date mismatch: official ${official.price.priceDate}, adjusted ${adjusted.price.priceDate}`,
      ],
    };
  }

  const closeDifference = Math.abs(adjusted.price.close / official.price.close - 1);
  if (closeDifference > 0.03) {
    const corporateAction = matchCorporateActionAdjustment({
      symbol: official.symbol,
      market: official.market,
      priceDate: official.price.priceDate,
      officialClose: official.price.close,
      adjustedClose: adjusted.price.close,
    });
    if (corporateAction) {
      const verifiedPrice: StockPrice = {
        ...official.price,
        adjClose: adjusted.price.adjClose ?? adjusted.price.close,
        provider: `${official.price.provider}+yahoo-chart`,
        verificationProvider:
          `${official.price.verificationProvider}+yahoo-adjustment-v1+${corporateAction.verificationVersion}`,
      };
      const quality = assessLatestPrice(official.symbol, "TW", {
        priceDate: verifiedPrice.priceDate,
        close: verifiedPrice.close,
        adjClose: verifiedPrice.adjClose ?? null,
        volume: verifiedPrice.volume ?? null,
        qualityStatus: verifiedPrice.qualityStatus,
        provider: verifiedPrice.provider,
        sourceUrl: verifiedPrice.sourceUrl,
        verificationProvider: verifiedPrice.verificationProvider,
      });
      return {
        ...official,
        status: quality.status === "verified" ? "fetched" : "error",
        price: quality.status === "verified" ? verifiedPrice : null,
        warnings: [
          ...official.warnings,
          ...adjusted.warnings,
          `Corporate action adjustment verified: factor ${corporateAction.observedFactor}, ex-date ${corporateAction.exDate}, registry ${corporateAction.verificationVersion}.`,
        ],
        errors: quality.status === "verified"
          ? official.errors
          : [...official.errors, quality.reason ?? "Corporate-action adjusted price failed final validation."],
      };
    }
    const gapPct = Number((closeDifference * 100).toFixed(2));
    const likelyCorporateActionGap = closeDifference <= 0.2;
    return {
      ...official,
      status: "error",
      price: null,
      errors: [
        ...official.errors,
        likelyCorporateActionGap
          ? `Cross-source adjusted close gap: official ${official.price.close}, Yahoo ${adjusted.price.close}, gap ${gapPct}%. Treat as pending corporate-action adjustment review.`
          : `Cross-source close mismatch: official ${official.price.close}, Yahoo ${adjusted.price.close}, gap ${gapPct}%.`,
      ],
    };
  }

  const verifiedPrice: StockPrice = {
    ...official.price,
    adjClose: adjusted.price.adjClose ?? adjusted.price.close,
    provider: `${official.price.provider}+yahoo-chart`,
    verificationProvider: `${official.price.verificationProvider}+yahoo-adjustment-v1`,
  };
  const quality = assessLatestPrice(official.symbol, "TW", {
    priceDate: verifiedPrice.priceDate,
    close: verifiedPrice.close,
    adjClose: verifiedPrice.adjClose ?? null,
    volume: verifiedPrice.volume ?? null,
    qualityStatus: verifiedPrice.qualityStatus,
    provider: verifiedPrice.provider,
    sourceUrl: verifiedPrice.sourceUrl,
    verificationProvider: verifiedPrice.verificationProvider,
  });
  if (quality.status !== "verified") {
    return {
      ...official,
      status: "error",
      price: null,
      warnings: [...official.warnings, ...adjusted.warnings],
      errors: [...official.errors, quality.reason ?? "Cross-source price failed final sanity validation."],
    };
  }

  return {
    ...official,
    status: "fetched",
    price: verifiedPrice,
    warnings: [...official.warnings, ...adjusted.warnings],
  };
}

function validateFetchedPrice(price: StockPrice, requestedDate: string, warnings: string[], errors: string[]) {
  if (!isIsoDate(price.priceDate)) {
    errors.push(`Invalid price date: ${price.priceDate}`);
  }

  if (price.priceDate > requestedDate) {
    errors.push(`Fetched price date ${price.priceDate} is after requested date ${requestedDate}`);
  }

  if (!Number.isFinite(price.close) || price.close <= 0) {
    errors.push(`Invalid close price: ${price.close}`);
  }

  if (price.adjClose !== undefined && (!Number.isFinite(price.adjClose) || price.adjClose <= 0)) {
    errors.push(`Invalid adjusted close price: ${price.adjClose}`);
  }

  if (price.volume !== undefined && (!Number.isFinite(price.volume) || price.volume < 0)) {
    errors.push(`Invalid volume: ${price.volume}`);
  }

  const distanceDays =
    (new Date(`${requestedDate}T00:00:00.000Z`).getTime() -
      new Date(`${price.priceDate}T00:00:00.000Z`).getTime()) /
    86_400_000;

  if (distanceDays > 7) {
    warnings.push(`Price date is ${distanceDays} days before requested date; market may have been closed or data missing.`);
  }
}

function validateFetchedPriceOnOrAfter(price: StockPrice, requestedDate: string, warnings: string[], errors: string[]) {
  if (!isIsoDate(price.priceDate)) errors.push(`Invalid price date: ${price.priceDate}`);
  if (price.priceDate < requestedDate) {
    errors.push(`Fetched price date ${price.priceDate} is before requested date ${requestedDate}`);
  }
  if (!Number.isFinite(price.close) || price.close <= 0) errors.push(`Invalid close price: ${price.close}`);
  if (price.volume !== undefined && (!Number.isFinite(price.volume) || price.volume < 0)) {
    errors.push(`Invalid volume: ${price.volume}`);
  }
  const distanceDays =
    (new Date(`${price.priceDate}T00:00:00.000Z`).getTime() -
      new Date(`${requestedDate}T00:00:00.000Z`).getTime()) /
    86_400_000;
  if (distanceDays > 7) warnings.push(`First available price is ${distanceDays} days after requested date.`);
}

async function fetchTwseListedPriceOnOrBefore(symbol: string, requestedDate: string, lookbackDays: number) {
  const stockNo = stockNoFromTwSymbol(symbol);
  const warnings: string[] = [];
  const errors: string[] = [];
  const startDate = addDays(requestedDate, -lookbackDays);
  const monthStarts = new Set<string>();

  for (let cursor = requestedDate; cursor >= startDate; cursor = addDays(cursor, -1)) {
    monthStarts.add(`${cursor.slice(0, 8)}01`);
  }

  const candidates: StockPrice[] = [];

  for (const monthStart of monthStarts) {
    const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${toTwseQueryDate(
      monthStart,
    )}&stockNo=${encodeURIComponent(stockNo)}`;
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "TrendRadar/1.0 stock price validation",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      warnings.push(`TWSE request failed for ${stockNo} ${monthStart}: HTTP ${response.status}`);
      continue;
    }

    const payload = (await response.json()) as TwseStockDayResponse;
    if (payload.stat !== "OK" || !Array.isArray(payload.data)) {
      warnings.push(`TWSE returned no monthly data for ${stockNo} ${monthStart}`);
      continue;
    }

    for (const row of payload.data) {
      const priceDate = parseTwseRocDate(row[0]);
      const close = parseTwseNumber(row[6]);
      const volume = parseTwseNumber(row[1]);

      if (!priceDate || close === null) continue;
      if (priceDate > requestedDate || priceDate < startDate) continue;

      candidates.push({
        symbol: normalizeSymbol(symbol),
        market: "TW",
        priceDate,
        close,
        adjClose: close,
        volume: volume ?? undefined,
        provider: "twse-official",
        sourceUrl: url,
        fetchedAt: new Date().toISOString(),
        qualityStatus: "verified",
        verificationProvider: "twse-official",
      });
    }
  }

  candidates.sort((a, b) => b.priceDate.localeCompare(a.priceDate));
  const price = candidates[0] ?? null;

  if (!price) {
    return {
      symbol: normalizeSymbol(symbol),
      market: "TW" as MarketCode,
      requestedDate,
      provider: "twse" as const,
      status: "skipped" as const,
      price: null,
      warnings,
      errors: [`No TWSE listed price found for ${symbol} on or before ${requestedDate}. OTC stocks require a TPEx source.`],
    };
  }

  validateFetchedPrice(price, requestedDate, warnings, errors);

  return {
    symbol: normalizeSymbol(symbol),
    market: "TW" as MarketCode,
    requestedDate,
    provider: "twse" as const,
    status: errors.length > 0 ? ("error" as const) : ("fetched" as const),
    price: errors.length > 0 ? null : price,
    warnings,
    errors,
  };
}

async function fetchTwseListedPriceOnOrAfter(symbol: string, requestedDate: string, lookforwardDays: number) {
  const stockNo = stockNoFromTwSymbol(symbol);
  const warnings: string[] = [];
  const errors: string[] = [];
  const endDate = addDays(requestedDate, lookforwardDays);
  const monthStarts = new Set([`${requestedDate.slice(0, 8)}01`, `${endDate.slice(0, 8)}01`]);
  const candidates: StockPrice[] = [];

  for (const monthStart of monthStarts) {
    const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${toTwseQueryDate(
      monthStart,
    )}&stockNo=${encodeURIComponent(stockNo)}`;
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "TrendRadar/1.0 stock price validation",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      warnings.push(`TWSE request failed for ${stockNo} ${monthStart}: HTTP ${response.status}`);
      continue;
    }
    const payload = (await response.json()) as TwseStockDayResponse;
    if (payload.stat !== "OK" || !Array.isArray(payload.data)) continue;

    for (const row of payload.data) {
      const priceDate = parseTwseRocDate(row[0]);
      const close = parseTwseNumber(row[6]);
      const volume = parseTwseNumber(row[1]);
      if (!priceDate || close === null || priceDate < requestedDate || priceDate > endDate) continue;
      candidates.push({
        symbol: normalizeSymbol(symbol),
        market: "TW",
        priceDate,
        close,
        adjClose: close,
        volume: volume ?? undefined,
        provider: "twse-official",
        sourceUrl: url,
        fetchedAt: new Date().toISOString(),
        qualityStatus: "verified",
        verificationProvider: "twse-official",
      });
    }
  }

  candidates.sort((a, b) => a.priceDate.localeCompare(b.priceDate));
  const price = candidates[0] ?? null;
  if (!price) {
    return {
      symbol: normalizeSymbol(symbol),
      market: "TW" as MarketCode,
      requestedDate,
      provider: "twse" as const,
      status: "skipped" as const,
      price: null,
      warnings,
      errors: [`No TWSE listed price found for ${symbol} on or after ${requestedDate}.`],
    };
  }

  validateFetchedPriceOnOrAfter(price, requestedDate, warnings, errors);
  return {
    symbol: normalizeSymbol(symbol),
    market: "TW" as MarketCode,
    requestedDate,
    provider: "twse" as const,
    status: errors.length > 0 ? ("error" as const) : ("fetched" as const),
    price: errors.length > 0 ? null : price,
    warnings,
    errors,
  };
}

export async function fetchValidatedStockPriceOnOrBefore(
  request: StockPriceFetchRequest,
  lookbackDays = 10,
): Promise<StockPriceFetchResult> {
  const symbol = normalizeSymbol(request.symbol);
  const date = request.date.trim();

  if (!isIsoDate(date)) {
    return {
      symbol,
      market: request.market,
      requestedDate: date,
      provider: "manual_required",
      status: "error",
      price: null,
      warnings: [],
      errors: [`Date must use YYYY-MM-DD format: ${request.date}`],
    };
  }

  if (request.market === "TW") {
    const twse = await fetchTwseListedPriceOnOrBefore(symbol, date, lookbackDays);
    if (twse.price) {
      return verifyTwPriceAdjustment(twse, date, "before", lookbackDays, symbol);
    }
    const tpex = await fetchTpexPrice(symbol, date, "before", lookbackDays);
    return tpex.price
      ? verifyTwPriceAdjustment(
          { ...tpex, warnings: [...twse.warnings, ...tpex.warnings] },
          date,
          "before",
          lookbackDays,
          symbol.replace(/\.TW$/, ".TWO"),
        )
      : { ...tpex, warnings: [...twse.warnings, ...tpex.warnings], errors: [...twse.errors, ...tpex.errors] };
  }

  if (request.market === "US") {
    return fetchCrossVerifiedUsPrice(symbol, date, "before", lookbackDays);
  }
  if (request.market === "KR" || request.market === "JP") {
    return fetchYahooPrice(symbol, request.market, date, "before", lookbackDays);
  }

  return {
    symbol,
    market: request.market,
    requestedDate: date,
    provider: "manual_required",
    status: "skipped",
    price: null,
    warnings: [
      "Automatic source is not enabled for this market yet. Use CSV import or connect a licensed market data provider.",
    ],
    errors: [],
  };
}

export async function fetchValidatedStockPriceOnOrAfter(
  request: StockPriceFetchRequest,
  lookforwardDays = 10,
): Promise<StockPriceFetchResult> {
  const symbol = normalizeSymbol(request.symbol);
  const date = request.date.trim();
  if (!isIsoDate(date)) {
    return {
      symbol,
      market: request.market,
      requestedDate: date,
      provider: "manual_required",
      status: "error",
      price: null,
      warnings: [],
      errors: [`Date must use YYYY-MM-DD format: ${request.date}`],
    };
  }
  if (request.market === "TW") {
    const twse = await fetchTwseListedPriceOnOrAfter(symbol, date, lookforwardDays);
    if (twse.price) {
      return verifyTwPriceAdjustment(twse, date, "after", lookforwardDays, symbol);
    }
    const tpex = await fetchTpexPrice(symbol, date, "after", lookforwardDays);
    return tpex.price
      ? verifyTwPriceAdjustment(
          { ...tpex, warnings: [...twse.warnings, ...tpex.warnings] },
          date,
          "after",
          lookforwardDays,
          symbol.replace(/\.TW$/, ".TWO"),
        )
      : { ...tpex, warnings: [...twse.warnings, ...tpex.warnings], errors: [...twse.errors, ...tpex.errors] };
  }
  if (request.market === "US") {
    return fetchCrossVerifiedUsPrice(symbol, date, "after", lookforwardDays);
  }
  if (request.market === "KR" || request.market === "JP") {
    return fetchYahooPrice(symbol, request.market, date, "after", lookforwardDays);
  }
  return {
    symbol,
    market: request.market,
    requestedDate: date,
    provider: "manual_required",
    status: "skipped",
    price: null,
    warnings: ["Automatic verified source is not enabled for this market yet."],
    errors: [],
  };
}

export async function fetchAndMaybeUpsertStockPrices(
  requests: StockPriceFetchRequest[],
  options: { dryRun?: boolean; lookbackDays?: number } = {},
) {
  const results: StockPriceFetchResult[] = [];

  for (const request of requests) {
    results.push(await fetchValidatedStockPriceOnOrBefore(request, options.lookbackDays ?? 10));
  }

  const prices = results
    .filter((result) => result.status === "fetched" && result.price)
    .map((result) => result.price as StockPrice);

  const upserted = options.dryRun ? { count: 0 } : await upsertStockPrices(prices);

  return {
    ok: results.every((result) => result.status !== "error"),
    dryRun: Boolean(options.dryRun),
    fetched: prices.length,
    upserted: upserted.count,
    skipped: results.filter((result) => result.status === "skipped").length,
    errors: results.flatMap((result) => result.errors.map((error) => `${result.symbol}: ${error}`)),
    results,
  };
}
