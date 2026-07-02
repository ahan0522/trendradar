import type { MarketCode } from "@/types/signals";

export type RawLatestPrice = {
  priceDate: string;
  close: number;
  adjClose: number | null;
  volume: number | null;
  qualityStatus?: string | null;
  provider?: string | null;
  sourceUrl?: string | null;
  verificationProvider?: string | null;
};

export type PriceQuality = {
  status: "verified" | "needs_review";
  reason?: string;
};

type SanityRange = {
  min: number;
  max: number;
  note: string;
  revision?: string;
  verifiedOn?: string;
  verificationBasis?: string;
  requiredVerificationProviders?: string[];
};

export const PRICE_SANITY_RANGE_VERSION = "price-sanity-v3-2026-07-02";

const sanityRanges: Record<string, SanityRange> = {
  "MU::US": { min: 20, max: 300, note: "Micron normal USD quote range" },
  "NVDA::US": { min: 20, max: 500, note: "NVIDIA split-adjusted USD quote range" },
  "AMD::US": { min: 20, max: 400, note: "AMD normal USD quote range" },
  "GEV::US": { min: 50, max: 1000, note: "GE Vernova normal USD quote range" },
  "ETN::US": { min: 50, max: 800, note: "Eaton normal USD quote range" },
  "VRT::US": { min: 20, max: 300, note: "Vertiv normal USD quote range" },
  "ABBNY::US": { min: 20, max: 120, note: "ABB Level I ADR normal USD quote range" },
  "AMKR::US": { min: 5, max: 80, note: "Amkor normal USD quote range" },
  "ASML::US": { min: 300, max: 2500, note: "ASML ADR normal USD quote range" },
  "AMAT::US": { min: 50, max: 800, note: "Applied Materials normal USD quote range" },
  "LRCX::US": { min: 20, max: 800, note: "Lam Research split-adjusted USD quote range" },
  "LMT::US": { min: 100, max: 1000, note: "Lockheed Martin normal USD quote range" },
  "RTX::US": { min: 30, max: 400, note: "RTX normal USD quote range" },
  "NOC::US": { min: 100, max: 1500, note: "Northrop Grumman normal USD quote range" },
  "GD::US": { min: 100, max: 700, note: "General Dynamics normal USD quote range" },
  "ROK::US": { min: 100, max: 700, note: "Rockwell Automation normal USD quote range" },
  "TER::US": { min: 20, max: 400, note: "Teradyne normal USD quote range" },
  "SPY::US": { min: 100, max: 1200, note: "SPY split-adjusted USD quote range" },
  "QQQ::US": { min: 100, max: 1200, note: "QQQ split-adjusted USD quote range" },

  "0050.TW::TW": { min: 20, max: 350, note: "元大台灣50除權息調整後合理區間" },
  "2330.TW::TW": { min: 300, max: 3000, note: "台積電台股報價合理區間" },
  "2317.TW::TW": { min: 30, max: 500, note: "鴻海台股報價合理區間" },
  "6669.TW::TW": { min: 500, max: 8000, note: "緯穎台股報價合理區間" },
  "2308.TW::TW": { min: 100, max: 2500, note: "台達電台股報價合理區間" },
  "1513.TW::TW": { min: 20, max: 500, note: "中興電台股報價合理區間" },
  "1519.TW::TW": { min: 50, max: 1800, note: "華城台股報價合理區間" },
  "2408.TW::TW": {
    min: 10,
    max: 600,
    note: "南亞科台股報價合理區間；2026-06-30 由 TWSE 官方收盤與 Yahoo 同日行情交叉驗證",
    revision: PRICE_SANITY_RANGE_VERSION,
    verifiedOn: "2026-06-30",
    verificationBasis: "TWSE STOCK_DAY official close plus Yahoo same-date structural and adjustment verification",
    requiredVerificationProviders: ["twse-official", "yahoo-adjustment-v1"],
  },
  "2344.TW::TW": {
    min: 5,
    max: 150,
    note: "華邦電台股報價合理區間；2026-07-02 由 TWSE 官方收盤與 Yahoo 同日調整價格交叉驗證",
    revision: PRICE_SANITY_RANGE_VERSION,
    verifiedOn: "2026-07-02",
    verificationBasis: "TWSE STOCK_DAY official close plus Yahoo same-date structural and adjustment verification",
    requiredVerificationProviders: ["twse-official", "yahoo-adjustment-v1"],
  },
  "8299.TW::TW": { min: 100, max: 4000, note: "群聯台股報價合理區間" },
  "3017.TW::TW": { min: 100, max: 2500, note: "奇鋐台股報價合理區間" },
  "3324.TW::TW": { min: 50, max: 1500, note: "雙鴻台股報價合理區間" },
  "3711.TW::TW": { min: 50, max: 1000, note: "日月光投控台股報價合理區間" },
  "3131.TW::TW": { min: 100, max: 3000, note: "弘塑台股報價合理區間" },
  "6187.TW::TW": {
    min: 30,
    max: 1500,
    note: "萬潤上櫃報價合理區間；2026-07-02 由 TPEx 官方收盤與 Yahoo 同日調整價格交叉驗證",
    revision: PRICE_SANITY_RANGE_VERSION,
    verifiedOn: "2026-07-02",
    verificationBasis: "TPEx official close plus Yahoo same-date structural and adjustment verification",
    requiredVerificationProviders: ["tpex-official", "yahoo-adjustment-v1"],
  },
  "3583.TW::TW": { min: 100, max: 3000, note: "辛耘台股報價合理區間" },
  "6451.TW::TW": { min: 100, max: 2000, note: "訊芯-KY 台股報價合理區間" },
  "3081.TW::TW": { min: 100, max: 5000, note: "聯亞上櫃報價合理區間" },
  "3363.TW::TW": { min: 50, max: 2000, note: "上詮上櫃報價合理區間" },
  "3163.TW::TW": { min: 50, max: 2000, note: "波若威上櫃報價合理區間" },
  "2634.TW::TW": { min: 20, max: 300, note: "漢翔台股報價合理區間" },
  "2049.TW::TW": { min: 50, max: 1500, note: "上銀台股報價合理區間" },

  "000660.KS::KR": { min: 50000, max: 600000, note: "SK Hynix KRW quote range" },
  "005930.KS::KR": { min: 30000, max: 150000, note: "Samsung Electronics KRW quote range" },
};

function key(symbol: string, market: MarketCode | string) {
  return `${symbol.trim().toUpperCase()}::${market}`;
}

export function assessLatestPrice(
  symbol: string,
  market: MarketCode | string,
  price: RawLatestPrice | null,
  options?: { asOfDate?: string; requireVerified?: boolean },
): PriceQuality {
  if (!price) return { status: "needs_review", reason: "資料庫尚未匯入可用價格" };
  if ((options?.requireVerified ?? true) && price.qualityStatus !== "verified") {
    return { status: "needs_review", reason: "價格尚未通過來源驗證" };
  }
  if (options?.asOfDate && price.priceDate > options.asOfDate) {
    return { status: "needs_review", reason: `價格日期 ${price.priceDate} 晚於研究時點 ${options.asOfDate}` };
  }
  if (price.qualityStatus === "verified" && (!price.provider || !price.sourceUrl)) {
    return { status: "needs_review", reason: "已驗證價格缺少 provider 或 source URL" };
  }

  const close = Number(price.adjClose ?? price.close);
  if (!Number.isFinite(close) || close <= 0) {
    return { status: "needs_review", reason: "價格不是有效正數" };
  }

  const range = sanityRanges[key(symbol, market)];
  if (!range) return { status: "needs_review", reason: "此標的尚未建立價格合理區間" };

  if (range.requiredVerificationProviders?.length) {
    const verificationProvider = price.verificationProvider?.toLowerCase() ?? "";
    const missingProviders = range.requiredVerificationProviders.filter(
      (provider) => !verificationProvider.includes(provider.toLowerCase()),
    );
    if (missingProviders.length > 0) {
      return {
        status: "needs_review",
        reason: `價格區間 ${range.revision ?? "unversioned"} 需要交叉驗證來源：${missingProviders.join(", ")}`,
      };
    }
  }

  if (close < range.min || close > range.max) {
    return {
      status: "needs_review",
      reason: `價格 ${close} 超出合理區間 ${range.min}-${range.max}，需重新驗證資料來源`,
    };
  }

  return { status: "verified", reason: range.note };
}

export function publishableLatestPrice(
  symbol: string,
  market: MarketCode | string,
  price: RawLatestPrice | null,
  options?: { asOfDate?: string; requireVerified?: boolean },
) {
  const quality = assessLatestPrice(symbol, market, price, options);
  return {
    latestPrice: quality.status === "verified" ? price : null,
    priceQuality: quality,
  };
}
