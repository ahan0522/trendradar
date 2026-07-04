import type { StockPrice } from "@/types/signals";

type AlphaVantageDailyResponse = {
  "Time Series (Daily)"?: Record<string, {
    "4. close"?: string;
    "5. volume"?: string;
  }>;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
};

export type IndependentUsClose = {
  symbol: string;
  priceDate: string;
  close: number;
  volume?: number;
  provider: "alpha-vantage-daily";
  sourceUrl: string;
};

export function parseAlphaVantageDailySeries(
  symbol: string,
  payload: AlphaVantageDailyResponse,
  sourceUrl: string,
) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const prices = new Map<string, IndependentUsClose>();

  for (const [priceDate, row] of Object.entries(payload["Time Series (Daily)"] ?? {})) {
    const close = Number(row["4. close"]);
    const volume = Number(row["5. volume"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(priceDate) || !Number.isFinite(close) || close <= 0) {
      continue;
    }
    prices.set(priceDate, {
      symbol: normalizedSymbol,
      priceDate,
      close,
      ...(Number.isFinite(volume) && volume >= 0 ? { volume } : {}),
      provider: "alpha-vantage-daily",
      sourceUrl,
    });
  }

  return prices;
}

export function crossVerifyUsPrice(
  yahooPrice: StockPrice,
  independent: IndependentUsClose,
  tolerance = 0.01,
): StockPrice | null {
  if (
    yahooPrice.market !== "US" ||
    yahooPrice.symbol.trim().toUpperCase() !== independent.symbol ||
    yahooPrice.priceDate !== independent.priceDate ||
    !Number.isFinite(yahooPrice.close) ||
    yahooPrice.close <= 0
  ) {
    return null;
  }

  const difference = Math.abs(yahooPrice.close / independent.close - 1);
  if (difference > tolerance) return null;

  return {
    ...yahooPrice,
    provider: "yahoo-chart+alpha-vantage",
    sourceUrl: independent.sourceUrl,
    qualityStatus: "verified",
    verificationProvider: "yahoo-chart+alpha-vantage-daily",
  };
}

export async function fetchAlphaVantageDailySeries(
  symbol: string,
  apiKey = process.env.ALPHA_VANTAGE_API_KEY,
) {
  if (!apiKey) {
    return { prices: new Map<string, IndependentUsClose>(), error: "ALPHA_VANTAGE_API_KEY is not configured." };
  }

  const normalizedSymbol = symbol.trim().toUpperCase();
  const publicParams = new URLSearchParams({
    function: "TIME_SERIES_DAILY",
    symbol: normalizedSymbol,
    outputsize: "full",
  });
  const requestParams = new URLSearchParams(publicParams);
  requestParams.set("apikey", apiKey);
  const sourceUrl = `https://www.alphavantage.co/query?${publicParams.toString()}`;
  const response = await fetch(
    `https://www.alphavantage.co/query?${requestParams.toString()}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    return {
      prices: new Map<string, IndependentUsClose>(),
      error: `Alpha Vantage request failed with HTTP ${response.status}.`,
    };
  }

  const payload = await response.json() as AlphaVantageDailyResponse;
  const providerError = payload.Note ?? payload.Information ?? payload["Error Message"];
  if (providerError) {
    return { prices: new Map<string, IndependentUsClose>(), error: providerError };
  }

  return {
    prices: parseAlphaVantageDailySeries(normalizedSymbol, payload, sourceUrl),
    error: null,
  };
}
