// Hand-maintained proxy basket of representative large-cap constituents per
// US sector Select Sector SPDR / semiconductor ETF, used only to surface
// top 3-5 stock movers alongside the ETF's own headline sector change. This
// is NOT live ETF holdings data (which needs a paid/licensed provider) --
// it mirrors how TW_THEME_GROUPS in lib/reports/market-brief.ts already
// works: a curated, versioned list reviewed periodically against public
// fact sheets, not a real-time constituent feed.
//
// Last reviewed: 2026-07.

export type UsSectorConstituent = { symbol: string; companyName: string };

export const US_SECTOR_ETF_CONSTITUENTS: Record<string, UsSectorConstituent[]> = {
  XLK: [
    { symbol: "AAPL", companyName: "Apple" },
    { symbol: "MSFT", companyName: "Microsoft" },
    { symbol: "NVDA", companyName: "NVIDIA" },
    { symbol: "AVGO", companyName: "Broadcom" },
    { symbol: "CRM", companyName: "Salesforce" },
  ],
  SMH: [
    { symbol: "NVDA", companyName: "NVIDIA" },
    { symbol: "TSM", companyName: "Taiwan Semiconductor Manufacturing" },
    { symbol: "AVGO", companyName: "Broadcom" },
    { symbol: "ASML", companyName: "ASML Holding" },
    { symbol: "AMD", companyName: "Advanced Micro Devices" },
  ],
  XLC: [
    { symbol: "META", companyName: "Meta Platforms" },
    { symbol: "GOOGL", companyName: "Alphabet" },
    { symbol: "NFLX", companyName: "Netflix" },
    { symbol: "TMUS", companyName: "T-Mobile US" },
    { symbol: "DIS", companyName: "Walt Disney" },
  ],
  XLY: [
    { symbol: "AMZN", companyName: "Amazon" },
    { symbol: "TSLA", companyName: "Tesla" },
    { symbol: "HD", companyName: "Home Depot" },
    { symbol: "MCD", companyName: "McDonald's" },
    { symbol: "LOW", companyName: "Lowe's" },
  ],
  XLF: [
    { symbol: "JPM", companyName: "JPMorgan Chase" },
    { symbol: "BAC", companyName: "Bank of America" },
    { symbol: "WFC", companyName: "Wells Fargo" },
    { symbol: "GS", companyName: "Goldman Sachs" },
    { symbol: "MS", companyName: "Morgan Stanley" },
  ],
  XLI: [
    { symbol: "GE", companyName: "GE Aerospace" },
    { symbol: "CAT", companyName: "Caterpillar" },
    { symbol: "RTX", companyName: "RTX Corporation" },
    { symbol: "HON", companyName: "Honeywell" },
    { symbol: "UNP", companyName: "Union Pacific" },
  ],
  XLE: [
    { symbol: "XOM", companyName: "ExxonMobil" },
    { symbol: "CVX", companyName: "Chevron" },
    { symbol: "COP", companyName: "ConocoPhillips" },
    { symbol: "EOG", companyName: "EOG Resources" },
    { symbol: "SLB", companyName: "SLB" },
  ],
  XLV: [
    { symbol: "LLY", companyName: "Eli Lilly" },
    { symbol: "UNH", companyName: "UnitedHealth Group" },
    { symbol: "JNJ", companyName: "Johnson & Johnson" },
    { symbol: "ABBV", companyName: "AbbVie" },
    { symbol: "MRK", companyName: "Merck" },
  ],
  XLP: [
    { symbol: "PG", companyName: "Procter & Gamble" },
    { symbol: "COST", companyName: "Costco" },
    { symbol: "KO", companyName: "Coca-Cola" },
    { symbol: "PEP", companyName: "PepsiCo" },
    { symbol: "WMT", companyName: "Walmart" },
  ],
  XLU: [
    { symbol: "NEE", companyName: "NextEra Energy" },
    { symbol: "SO", companyName: "Southern Company" },
    { symbol: "DUK", companyName: "Duke Energy" },
    { symbol: "CEG", companyName: "Constellation Energy" },
    { symbol: "AEP", companyName: "American Electric Power" },
  ],
  XLB: [
    { symbol: "LIN", companyName: "Linde" },
    { symbol: "SHW", companyName: "Sherwin-Williams" },
    { symbol: "APD", companyName: "Air Products and Chemicals" },
    { symbol: "FCX", companyName: "Freeport-McMoRan" },
    { symbol: "ECL", companyName: "Ecolab" },
  ],
  XLRE: [
    { symbol: "PLD", companyName: "Prologis" },
    { symbol: "AMT", companyName: "American Tower" },
    { symbol: "EQIX", companyName: "Equinix" },
    { symbol: "WELL", companyName: "Welltower" },
    { symbol: "SPG", companyName: "Simon Property Group" },
  ],
};
