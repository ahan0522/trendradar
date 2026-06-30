type CorporateActionAdjustment = {
  symbol: string;
  market: "TW";
  exDate: string;
  adjustmentFactor: number;
  actionType: "stock_dividend";
  sourceName: string;
  sourceUrl: string;
  verificationVersion: string;
};

export const CORPORATE_ACTION_REGISTRY_VERSION = "tw-corporate-actions-v1-2026-06-30";

const corporateActionAdjustments: CorporateActionAdjustment[] = [
  {
    symbol: "1519.TW",
    market: "TW",
    exDate: "2025-07-25",
    adjustmentFactor: 1.1,
    actionType: "stock_dividend",
    sourceName: "TWSE ex-right/ex-dividend announcement",
    sourceUrl: "https://www.twse.com.tw/zh/announcement/ex-right/twt49u.html",
    verificationVersion: CORPORATE_ACTION_REGISTRY_VERSION,
  },
];

export function matchCorporateActionAdjustment(input: {
  symbol: string;
  market: string;
  priceDate: string;
  officialClose: number;
  adjustedClose: number;
}) {
  const action = corporateActionAdjustments.find((item) =>
    item.symbol === input.symbol.toUpperCase() &&
    item.market === input.market &&
    input.priceDate < item.exDate,
  );
  if (!action || input.officialClose <= 0 || input.adjustedClose <= 0) return null;

  const observedFactor = input.officialClose / input.adjustedClose;
  const factorGap = Math.abs(observedFactor / action.adjustmentFactor - 1);
  if (factorGap > 0.005) return null;

  return {
    ...action,
    observedFactor: Number(observedFactor.toFixed(6)),
    factorGapPct: Number((factorGap * 100).toFixed(4)),
  };
}
