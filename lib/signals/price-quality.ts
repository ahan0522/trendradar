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
  legacyMax?: number;
  note: string;
  revision?: string;
  verifiedOn?: string;
  verificationBasis?: string;
  requiredVerificationProviders?: string[];
};

export const PRICE_SANITY_RANGE_VERSION = "price-sanity-v4-2026-07-06";
export const US_PRICE_SANITY_RANGE_VERSION = "us-price-sanity-v1-2026-07-04";

const sanityRanges: Record<string, SanityRange> = {
  "MU::US": {
    min: 20,
    max: 1200,
    legacyMax: 300,
    note: "Micron USD quote range; values above the legacy ceiling require independent daily-close verification",
    revision: US_PRICE_SANITY_RANGE_VERSION,
    requiredVerificationProviders: ["yahoo-chart", "alpha-vantage-daily"],
  },
  "NVDA::US": { min: 20, max: 500, note: "NVIDIA split-adjusted USD quote range" },
  "AMD::US": {
    min: 20,
    max: 650,
    legacyMax: 400,
    note: "AMD USD quote range; values above the legacy ceiling require independent daily-close verification",
    revision: US_PRICE_SANITY_RANGE_VERSION,
    requiredVerificationProviders: ["yahoo-chart", "alpha-vantage-daily"],
  },
  "GEV::US": {
    min: 50,
    max: 1300,
    legacyMax: 1000,
    note: "GE Vernova USD quote range; values above the legacy ceiling require independent daily-close verification",
    revision: US_PRICE_SANITY_RANGE_VERSION,
    requiredVerificationProviders: ["yahoo-chart", "alpha-vantage-daily"],
  },
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

  // Market brief indices, sector ETFs, and maintained sector-constituent
  // stocks (see data/us-sector-constituents.ts). Ranges are generously wide
  // (roughly 0.3x-3.5x of the July 2026 observed close, 0.35x-2.5x for
  // indices) to avoid false rejections from ordinary price moves, while
  // still catching garbage/misparsed values. ASML, RTX, NVDA, and AMD
  // already have dedicated entries above from prior signal work.
  "^DJI::US": { min: 18500, max: 132000, note: "Dow Jones Industrial Average market-brief USD quote range" },
  "^IXIC::US": { min: 9000, max: 66000, note: "Nasdaq Composite market-brief USD quote range" },
  "^GSPC::US": { min: 2650, max: 19000, note: "S&P 500 market-brief USD quote range" },
  "^SOX::US": { min: 4550, max: 32000, note: "Philadelphia Semiconductor Index market-brief USD quote range" },
  "^VIX::US": { min: 5, max: 100, note: "CBOE Volatility Index market-brief quote range (wide band to cover crisis spikes)" },
  "XLK::US": { min: 60, max: 650, note: "Technology Select Sector SPDR market-brief USD quote range" },
  "SMH::US": { min: 180, max: 2100, note: "VanEck Semiconductor ETF market-brief USD quote range" },
  "XLC::US": { min: 35, max: 400, note: "Communication Services Select Sector SPDR market-brief USD quote range" },
  "XLY::US": { min: 35, max: 400, note: "Consumer Discretionary Select Sector SPDR market-brief USD quote range" },
  "XLF::US": { min: 15, max: 190, note: "Financial Select Sector SPDR market-brief USD quote range" },
  "XLI::US": { min: 50, max: 650, note: "Industrial Select Sector SPDR market-brief USD quote range" },
  "XLE::US": { min: 15, max: 190, note: "Energy Select Sector SPDR market-brief USD quote range" },
  "XLV::US": { min: 50, max: 550, note: "Health Care Select Sector SPDR market-brief USD quote range" },
  "XLP::US": { min: 25, max: 300, note: "Consumer Staples Select Sector SPDR market-brief USD quote range" },
  "XLU::US": { min: 15, max: 160, note: "Utilities Select Sector SPDR market-brief USD quote range" },
  "XLB::US": { min: 15, max: 180, note: "Materials Select Sector SPDR market-brief USD quote range" },
  "XLRE::US": { min: 15, max: 160, note: "Real Estate Select Sector SPDR market-brief USD quote range" },
  "AAPL::US": { min: 90, max: 1100, note: "Apple market-brief USD quote range" },
  "MSFT::US": { min: 120, max: 1300, note: "Microsoft market-brief USD quote range" },
  "AVGO::US": { min: 120, max: 1400, note: "Broadcom market-brief USD quote range" },
  "CRM::US": { min: 50, max: 550, note: "Salesforce market-brief USD quote range" },
  "TSM::US": { min: 130, max: 1500, note: "Taiwan Semiconductor Manufacturing market-brief USD quote range" },
  "META::US": { min: 200, max: 2300, note: "Meta Platforms market-brief USD quote range" },
  "GOOGL::US": { min: 110, max: 1300, note: "Alphabet market-brief USD quote range" },
  "NFLX::US": { min: 20, max: 250, note: "Netflix market-brief USD quote range" },
  "TMUS::US": { min: 60, max: 650, note: "T-Mobile US market-brief USD quote range" },
  "DIS::US": { min: 30, max: 350, note: "Walt Disney market-brief USD quote range" },
  "AMZN::US": { min: 70, max: 850, note: "Amazon market-brief USD quote range" },
  "TSLA::US": { min: 120, max: 1400, note: "Tesla market-brief USD quote range" },
  "HD::US": { min: 100, max: 1200, note: "Home Depot market-brief USD quote range" },
  "MCD::US": { min: 80, max: 950, note: "McDonald's market-brief USD quote range" },
  "LOW::US": { min: 60, max: 750, note: "Lowe's market-brief USD quote range" },
  "JPM::US": { min: 100, max: 1200, note: "JPMorgan Chase market-brief USD quote range" },
  "BAC::US": { min: 20, max: 200, note: "Bank of America market-brief USD quote range" },
  "WFC::US": { min: 25, max: 300, note: "Wells Fargo market-brief USD quote range" },
  "GS::US": { min: 320, max: 3700, note: "Goldman Sachs market-brief USD quote range" },
  "MS::US": { min: 70, max: 800, note: "Morgan Stanley market-brief USD quote range" },
  "GE::US": { min: 110, max: 1300, note: "GE Aerospace market-brief USD quote range" },
  "CAT::US": { min: 290, max: 3300, note: "Caterpillar market-brief USD quote range" },
  "HON::US": { min: 70, max: 800, note: "Honeywell market-brief USD quote range" },
  "UNP::US": { min: 90, max: 1000, note: "Union Pacific market-brief USD quote range" },
  "XOM::US": { min: 40, max: 500, note: "ExxonMobil market-brief USD quote range" },
  "CVX::US": { min: 50, max: 600, note: "Chevron market-brief USD quote range" },
  "COP::US": { min: 35, max: 400, note: "ConocoPhillips market-brief USD quote range" },
  "EOG::US": { min: 40, max: 450, note: "EOG Resources market-brief USD quote range" },
  "SLB::US": { min: 15, max: 170, note: "SLB market-brief USD quote range" },
  "LLY::US": { min: 360, max: 4200, note: "Eli Lilly market-brief USD quote range" },
  "UNH::US": { min: 130, max: 1500, note: "UnitedHealth Group market-brief USD quote range" },
  "JNJ::US": { min: 80, max: 900, note: "Johnson & Johnson market-brief USD quote range" },
  "ABBV::US": { min: 70, max: 850, note: "AbbVie market-brief USD quote range" },
  "MRK::US": { min: 35, max: 450, note: "Merck market-brief USD quote range" },
  "PG::US": { min: 45, max: 500, note: "Procter & Gamble market-brief USD quote range" },
  "COST::US": { min: 270, max: 3200, note: "Costco market-brief USD quote range" },
  "KO::US": { min: 25, max: 300, note: "Coca-Cola market-brief USD quote range" },
  "PEP::US": { min: 40, max: 500, note: "PepsiCo market-brief USD quote range" },
  "WMT::US": { min: 35, max: 400, note: "Walmart market-brief USD quote range" },
  "NEE::US": { min: 25, max: 300, note: "NextEra Energy market-brief USD quote range" },
  "SO::US": { min: 30, max: 350, note: "Southern Company market-brief USD quote range" },
  "DUK::US": { min: 40, max: 450, note: "Duke Energy market-brief USD quote range" },
  "CEG::US": { min: 80, max: 900, note: "Constellation Energy market-brief USD quote range" },
  "AEP::US": { min: 40, max: 450, note: "American Electric Power market-brief USD quote range" },
  "LIN::US": { min: 160, max: 1900, note: "Linde market-brief USD quote range" },
  "SHW::US": { min: 100, max: 1200, note: "Sherwin-Williams market-brief USD quote range" },
  "APD::US": { min: 90, max: 1000, note: "Air Products and Chemicals market-brief USD quote range" },
  "FCX::US": { min: 20, max: 200, note: "Freeport-McMoRan market-brief USD quote range" },
  "ECL::US": { min: 80, max: 950, note: "Ecolab market-brief USD quote range" },
  "PLD::US": { min: 40, max: 500, note: "Prologis market-brief USD quote range" },
  "AMT::US": { min: 50, max: 600, note: "American Tower market-brief USD quote range" },
  "EQIX::US": { min: 320, max: 3700, note: "Equinix market-brief USD quote range" },
  "WELL::US": { min: 70, max: 800, note: "Welltower market-brief USD quote range" },
  "SPG::US": { min: 70, max: 750, note: "Simon Property Group market-brief USD quote range" },

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
    max: 350,
    legacyMax: 150,
    note: "華邦電台股報價合理區間；2026-06-30 收盤 207.50 由 TWSE 官方資料與 Yahoo 同日行情交叉驗證",
    revision: PRICE_SANITY_RANGE_VERSION,
    verifiedOn: "2026-06-30",
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

  // 金融、航運、PCB、機器人與自動化族群（2026-07 新增）
  "2881.TW::TW": { min: 40, max: 450, note: "富邦金台股報價合理區間" },
  "2882.TW::TW": { min: 30, max: 350, note: "國泰金台股報價合理區間" },
  "2891.TW::TW": { min: 20, max: 250, note: "中信金台股報價合理區間" },
  "2886.TW::TW": { min: 15, max: 170, note: "兆豐金台股報價合理區間" },
  "2884.TW::TW": { min: 10, max: 130, note: "玉山金台股報價合理區間" },
  "2603.TW::TW": { min: 50, max: 700, note: "長榮台股報價合理區間" },
  "2609.TW::TW": { min: 15, max: 200, note: "陽明台股報價合理區間" },
  "2615.TW::TW": { min: 25, max: 300, note: "萬海台股報價合理區間" },
  "6274.TW::TW": { min: 400, max: 5500, note: "台燿台股報價合理區間" },
  "3037.TW::TW": { min: 250, max: 3200, note: "欣興台股報價合理區間" },
  "2368.TW::TW": { min: 30, max: 400, note: "金像電台股報價合理區間" },
  "2367.TW::TW": { min: 15, max: 200, note: "燿華台股報價合理區間" },
  "2383.TW::TW": { min: 30, max: 400, note: "台光電台股報價合理區間" },
  "1590.TW::TW": { min: 300, max: 4500, note: "亞德客-KY 台股報價合理區間" },
  "7750.TW::TW": { min: 500, max: 7000, note: "新代台股報價合理區間" },
  "6438.TW::TW": { min: 40, max: 500, note: "迅得台股報價合理區間" },

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
  if (market === "US") {
    const verificationProvider = price.verificationProvider?.toLowerCase() ?? "";
    const requiredProviders = ["yahoo-chart", "alpha-vantage-daily"];
    const missingProviders = requiredProviders.filter(
      (provider) => !verificationProvider.includes(provider),
    );
    if (missingProviders.length > 0) {
      return {
        status: "needs_review",
        reason: `美股價格需要雙來源同日驗證：${missingProviders.join(", ")}`,
      };
    }
  }

  const close = Number(price.adjClose ?? price.close);
  if (!Number.isFinite(close) || close <= 0) {
    return { status: "needs_review", reason: "價格不是有效正數" };
  }

  const range = sanityRanges[key(symbol, market)];
  if (!range) return { status: "needs_review", reason: "此標的尚未建立價格合理區間" };

  const requiredVerificationProviders = range.requiredVerificationProviders ?? [];
  const requiresRevisedRangeVerification =
    requiredVerificationProviders.length > 0 &&
    (range.legacyMax === undefined || close > range.legacyMax);
  if (requiresRevisedRangeVerification) {
    const verificationProvider = price.verificationProvider?.toLowerCase() ?? "";
    const missingProviders = requiredVerificationProviders.filter(
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
