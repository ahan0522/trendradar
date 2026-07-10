export const LIVE_SIGNAL_LEDGER_START_DATE = "2026-07-01";

export type SignalDataMode = "live-ledger" | "historical-audit";

export function signalDataModeForDate(asOfDate: string): SignalDataMode {
  return asOfDate >= LIVE_SIGNAL_LEDGER_START_DATE ? "live-ledger" : "historical-audit";
}

export function isLiveSignalLedgerDate(asOfDate: string) {
  return signalDataModeForDate(asOfDate) === "live-ledger";
}

export const LIVE_COLLECTION_POLICY = {
  startDate: LIVE_SIGNAL_LEDGER_START_DATE,
  liveMode: "live-ledger" as const,
  historicalMode: "historical-audit" as const,
  policyVersion: "live-first-2026-07",
  description:
    "TrendRadar treats 2026-07-01 onward as the formal live Signal Ledger. Older backfilled data remains audit/sample material unless independently time-verified.",
};
