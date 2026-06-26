import type { MarketCode } from "@/types/signals";

export type RawLatestPrice = {
  priceDate: string;
  close: number;
  adjClose: number | null;
  volume: number | null;
};

export type PriceQuality = {
  status: "verified" | "needs_review";
  reason?: string;
};

const sanityRanges: Record<string, { min: number; max: number; note: string }> = {
  "MU::US": { min: 20, max: 300, note: "Micron normal USD quote range" },
  "NVDA::US": { min: 20, max: 500, note: "NVIDIA split-adjusted USD quote range" },
  "AMD::US": { min: 20, max: 400, note: "AMD normal USD quote range" },
  "GEV::US": { min: 50, max: 1000, note: "GE Vernova normal USD quote range" },
  "ETN::US": { min: 50, max: 800, note: "Eaton normal USD quote range" },
  "VRT::US": { min: 20, max: 300, note: "Vertiv normal USD quote range" },
  "ABB::US": { min: 20, max: 120, note: "ABB ADR normal USD quote range" },
  "AMKR::US": { min: 5, max: 80, note: "Amkor normal USD quote range" },

  "2330.TW::TW": { min: 300, max: 3000, note: "台積電台股報價合理區間" },
  "2317.TW::TW": { min: 30, max: 500, note: "鴻海台股報價合理區間" },
  "6669.TW::TW": { min: 500, max: 8000, note: "緯穎台股報價合理區間" },
  "2308.TW::TW": { min: 100, max: 2500, note: "台達電台股報價合理區間" },
  "1513.TW::TW": { min: 20, max: 500, note: "中興電台股報價合理區間" },
  "1519.TW::TW": { min: 50, max: 1800, note: "華城台股報價合理區間" },
  "2408.TW::TW": { min: 10, max: 180, note: "南亞科台股報價合理區間" },
  "2344.TW::TW": { min: 5, max: 100, note: "華邦電台股報價合理區間" },
  "8299.TW::TW": { min: 100, max: 2000, note: "群聯台股報價合理區間" },
  "3017.TW::TW": { min: 100, max: 2500, note: "奇鋐台股報價合理區間" },
  "3324.TW::TW": { min: 50, max: 1500, note: "雙鴻台股報價合理區間" },
  "3711.TW::TW": { min: 50, max: 500, note: "日月光投控台股報價合理區間" },
  "3131.TW::TW": { min: 100, max: 3000, note: "弘塑台股報價合理區間" },
  "6187.TW::TW": { min: 30, max: 1000, note: "萬潤台股報價合理區間" },
  "3583.TW::TW": { min: 100, max: 3000, note: "辛耘台股報價合理區間" },

  "000660.KS::KR": { min: 50000, max: 600000, note: "SK Hynix KRW quote range" },
  "005930.KS::KR": { min: 30000, max: 150000, note: "Samsung Electronics KRW quote range" },
};

function key(symbol: string, market: MarketCode | string) {
  return `${symbol.trim().toUpperCase()}::${market}`;
}

export function assessLatestPrice(symbol: string, market: MarketCode | string, price: RawLatestPrice | null): PriceQuality {
  if (!price) return { status: "needs_review", reason: "資料庫尚未匯入可用價格" };

  const close = Number(price.adjClose ?? price.close);
  if (!Number.isFinite(close) || close <= 0) {
    return { status: "needs_review", reason: "價格不是有效正數" };
  }

  const range = sanityRanges[key(symbol, market)];
  if (!range) return { status: "needs_review", reason: "此標的尚未建立價格合理區間" };

  if (close < range.min || close > range.max) {
    return {
      status: "needs_review",
      reason: `價格 ${close} 超出合理區間 ${range.min}-${range.max}，需重新驗證資料來源`,
    };
  }

  return { status: "verified", reason: range.note };
}

export function publishableLatestPrice(symbol: string, market: MarketCode | string, price: RawLatestPrice | null) {
  const quality = assessLatestPrice(symbol, market, price);
  return {
    latestPrice: quality.status === "verified" ? price : null,
    priceQuality: quality,
  };
}
