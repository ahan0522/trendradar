import type { MarketCode, StockPrice } from "@/types/signals";
import { upsertStockPrices } from "@/lib/signals/stock-prices";

export type PriceSourceProvider = "twse" | "manual_required";

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

function stockNoFromTwSymbol(symbol: string) {
  return normalizeSymbol(symbol).replace(".TW", "").replace(".TWO", "");
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
    return fetchTwseListedPriceOnOrBefore(symbol, date, lookbackDays);
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
  if (request.market === "TW") return fetchTwseListedPriceOnOrAfter(symbol, date, lookforwardDays);
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
