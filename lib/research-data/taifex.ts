import { getSupabaseAdmin } from "@/lib/supabase-server";

const TAIFEX_INSTITUTIONAL_OI_URL =
  "https://openapi.taifex.com.tw/v1/MarketDataOfMajorInstitutionalTradersDetailsOfFuturesContractsBytheDate";
const TAIFEX_DAILY_FUTURES_URL = "https://openapi.taifex.com.tw/v1/DailyMarketReportFut";
const TW_INDEX_FUTURES_CONTRACT_CODE = "臺股期貨";
const TW_INDEX_FUTURES_CONTRACT = "TX";
const AFTER_HOURS_FRONT_MONTH_SYMBOL = "WTX&";

async function fetchTaifexJson<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "TrendRadar/1.0 research-data@trendradar",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`TAIFEX request failed: ${response.status} ${url}`);
  return (await response.json()) as T;
}

function parseTaifexCalendarDate(value: string | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 8) throw new Error(`Invalid TAIFEX calendar date: ${value ?? "missing"}`);
  const result = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const parsed = new Date(`${result}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) {
    throw new Error(`Invalid TAIFEX calendar date: ${value ?? "missing"}`);
  }
  return result;
}

// Defensive: the field survey confirmed TAIFEX returns plain digit strings for
// these two endpoints today, but also uses sentinel strings like "NULL"/"-"
// for not-applicable fields (e.g. after-hours rows have no settlement price),
// and a "%" field with a trailing percent sign. Handle both formats and
// sentinels rather than assuming a single shape.
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/,/g, "").replace(/%$/, "");
  if (!normalized || normalized === "-" || normalized.toUpperCase() === "NULL") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export type TaifexFuturesInstitutionalOi = {
  tradeDate: string;
  investor: "外資" | "投信" | "自營商" | "三大法人";
  longContracts: number | null;
  shortContracts: number | null;
  netContracts: number | null;
  longVolume: number | null;
  shortVolume: number | null;
  sourceUrl: string;
  fetchedAt: string;
};

type TaifexInstitutionalOiRow = {
  Date?: string;
  ContractCode?: string;
  Item?: string;
  "TradingVolume(Long)"?: string;
  "TradingVolume(Short)"?: string;
  "OpenInterest(Long)"?: string;
  "OpenInterest(Short)"?: string;
  "OpenInterest(Net)"?: string;
};

export async function fetchTaifexFuturesInstitutionalOi(): Promise<TaifexFuturesInstitutionalOi[]> {
  const fetchedAt = new Date().toISOString();
  const rows = await fetchTaifexJson<TaifexInstitutionalOiRow[]>(TAIFEX_INSTITUTIONAL_OI_URL);
  if (!Array.isArray(rows)) return [];

  const relevant = rows.filter((row) => row.ContractCode === TW_INDEX_FUTURES_CONTRACT_CODE);
  if (relevant.length === 0) return [];

  const tradeDate = parseTaifexCalendarDate(relevant[0]?.Date);
  const labelMap: Record<string, TaifexFuturesInstitutionalOi["investor"]> = {
    自營商: "自營商",
    投信: "投信",
    外資及陸資: "外資",
  };

  const mapped = relevant.flatMap((row): TaifexFuturesInstitutionalOi[] => {
    const investor = row.Item ? labelMap[row.Item] : undefined;
    if (!investor) return [];
    return [{
      tradeDate,
      investor,
      longContracts: toNumber(row["OpenInterest(Long)"]),
      shortContracts: toNumber(row["OpenInterest(Short)"]),
      netContracts: toNumber(row["OpenInterest(Net)"]),
      longVolume: toNumber(row["TradingVolume(Long)"]),
      shortVolume: toNumber(row["TradingVolume(Short)"]),
      sourceUrl: TAIFEX_INSTITUTIONAL_OI_URL,
      fetchedAt,
    }];
  });

  const total = mapped.reduce(
    (acc, row) => ({
      longContracts: acc.longContracts + (row.longContracts ?? 0),
      shortContracts: acc.shortContracts + (row.shortContracts ?? 0),
      netContracts: acc.netContracts + (row.netContracts ?? 0),
      longVolume: acc.longVolume + (row.longVolume ?? 0),
      shortVolume: acc.shortVolume + (row.shortVolume ?? 0),
    }),
    { longContracts: 0, shortContracts: 0, netContracts: 0, longVolume: 0, shortVolume: 0 },
  );

  return [
    ...mapped,
    {
      tradeDate,
      investor: "三大法人",
      sourceUrl: TAIFEX_INSTITUTIONAL_OI_URL,
      fetchedAt,
      ...total,
    },
  ];
}

export type TaifexFrontMonthAfterHoursFutures = {
  tradeDate: string;
  contractMonth: string;
  last: number | null;
  change: number | null;
  changePct: number | null;
  sourceUrl: string;
  fetchedAt: string;
};

type TaifexDailyFuturesRow = {
  Date?: string;
  Contract?: string;
  "ContractMonth(Week)"?: string;
  Last?: string;
  Change?: string;
  "%"?: string;
  TradingSession?: string;
};

export async function fetchTaifexFrontMonthAfterHoursFutures(): Promise<TaifexFrontMonthAfterHoursFutures | null> {
  const fetchedAt = new Date().toISOString();
  const rows = await fetchTaifexJson<TaifexDailyFuturesRow[]>(TAIFEX_DAILY_FUTURES_URL);
  if (!Array.isArray(rows)) return null;

  const txAfterHours = rows.filter((row) =>
    row.Contract === TW_INDEX_FUTURES_CONTRACT && row.TradingSession === "盤後");
  if (txAfterHours.length === 0) return null;

  const front = txAfterHours.reduce((min, row) =>
    Number(row["ContractMonth(Week)"]) < Number(min["ContractMonth(Week)"]) ? row : min);
  const last = toNumber(front.Last);
  if (!front.Date || last === null) return null;

  return {
    tradeDate: parseTaifexCalendarDate(front.Date),
    contractMonth: String(front["ContractMonth(Week)"]),
    last,
    change: toNumber(front.Change),
    changePct: toNumber(front["%"]),
    sourceUrl: TAIFEX_DAILY_FUTURES_URL,
    fetchedAt,
  };
}

export async function syncTaifexResearchData(options?: { dryRun?: boolean }) {
  const dryRun = options?.dryRun ?? true;
  const [oiRows, futuresQuote] = await Promise.all([
    fetchTaifexFuturesInstitutionalOi().catch(() => []),
    fetchTaifexFrontMonthAfterHoursFutures().catch(() => null),
  ]);

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      oiCount: oiRows.length,
      futuresQuote,
      oiSamples: oiRows.slice(0, 4),
    };
  }

  const supabase = getSupabaseAdmin();

  if (oiRows.length > 0) {
    const { error } = await supabase
      .from("taifex_futures_institutional_oi")
      .upsert(
        oiRows.map((row) => ({
          trade_date: row.tradeDate,
          contract_code: TW_INDEX_FUTURES_CONTRACT_CODE,
          investor: row.investor,
          long_contracts: row.longContracts,
          short_contracts: row.shortContracts,
          net_contracts: row.netContracts,
          long_volume: row.longVolume,
          short_volume: row.shortVolume,
          provider: "taifex-openapi",
          source_url: row.sourceUrl,
          fetched_at: row.fetchedAt,
          quality_status: "verified",
          verified_at: row.fetchedAt,
          verification_provider: "taifex-openapi",
          updated_at: row.fetchedAt,
        })),
        { onConflict: "trade_date,contract_code,investor" },
      );
    if (error) throw error;
  }

  if (futuresQuote) {
    // Mirror the front-month after-hours quote into stock_prices under a
    // synthetic symbol so the existing generic index-move/streak pipeline
    // (buildIndexMoveFromPrices/indexStreakLabel) works on it unmodified.
    const { error } = await supabase
      .from("stock_prices")
      .upsert(
        [{
          symbol: AFTER_HOURS_FRONT_MONTH_SYMBOL,
          market: "TW",
          price_date: futuresQuote.tradeDate,
          close: futuresQuote.last,
          adj_close: futuresQuote.last,
          provider: "taifex-openapi",
          source_url: futuresQuote.sourceUrl,
          fetched_at: futuresQuote.fetchedAt,
          quality_status: "verified",
          verified_at: futuresQuote.fetchedAt,
          verification_provider: "taifex-openapi",
          updated_at: futuresQuote.fetchedAt,
        }],
        { onConflict: "symbol,market,price_date" },
      );
    if (error) throw error;
  }

  return {
    ok: true,
    dryRun: false,
    oiCount: oiRows.length,
    futuresQuote,
  };
}
