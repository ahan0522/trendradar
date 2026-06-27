import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  upsertCompanyActions,
  upsertResearchSources,
} from "@/lib/research-data/repository";
import type { CompanyAction, ResearchSource } from "@/types/research-data";

const TWSE_ACTIONS_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap04_L";
const TWSE_PRICES_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";

type TwseActionRow = {
  出表日期?: string;
  發言日期?: string;
  發言時間?: string;
  公司代號?: string;
  公司名稱?: string;
  "主旨 "?: string;
  主旨?: string;
  事實發生日?: string;
  說明?: string;
};

type TwsePriceRow = {
  Date?: string;
  Code?: string;
  Name?: string;
  TradeVolume?: string;
  OpeningPrice?: string;
  HighestPrice?: string;
  LowestPrice?: string;
  ClosingPrice?: string;
};

const twseSource: ResearchSource = {
  id: "twse-openapi",
  name: "臺灣證券交易所 OpenAPI",
  sourceType: "official",
  baseUrl: "https://openapi.twse.com.tw/",
  authorityLevel: "primary",
  reliabilityScore: 95,
};

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function parseRocDate(value: string | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 7) throw new Error(`Invalid TWSE ROC date: ${value ?? "missing"}`);
  const year = Number(digits.slice(0, 3)) + 1911;
  const month = digits.slice(3, 5);
  const day = digits.slice(5, 7);
  return `${year}-${month}-${day}`;
}

function parsePublishedAt(dateValue: string | undefined, timeValue?: string) {
  const date = parseRocDate(dateValue);
  const digits = (timeValue ?? "0000").replace(/\D/g, "").padStart(4, "0");
  return `${date}T${digits.slice(0, 2)}:${digits.slice(2, 4)}:00+08:00`;
}

function parsePositiveNumber(value: string | undefined) {
  const parsed = Number((value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function classifyAction(title: string, summary: string): CompanyAction["actionType"] {
  const text = `${title} ${summary}`.toLowerCase();
  if (/財測|展望|guidance/.test(text)) return "guidance";
  if (/資本支出|capex|投資計畫/.test(text)) return "capex";
  if (/擴產|產能|新廠|量產|停產|減產/.test(text)) return "capacity";
  if (/價格調整|漲價|降價|報價/.test(text)) return "pricing";
  if (/合約|訂單|採購|得標/.test(text)) return "contract";
  if (/新產品|產品發表|認證/.test(text)) return "product";
  if (/併購|收購|合併|處分.*股權/.test(text)) return "m_and_a";
  return "filing";
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "TrendRadar/1.0 research-data@trendradar",
    },
  });
  if (!response.ok) throw new Error(`TWSE request failed: ${response.status} ${url}`);
  return (await response.json()) as T;
}

export async function fetchTwseCompanyActions() {
  const rows = await fetchJson<TwseActionRow[]>(TWSE_ACTIONS_URL);
  const observedAt = new Date().toISOString();

  return rows.flatMap((row): CompanyAction[] => {
    const symbol = row.公司代號?.trim();
    const companyName = row.公司名稱?.trim();
    const title = (row["主旨 "] ?? row.主旨 ?? "").trim();
    if (!symbol || !companyName || !title || !row.發言日期) return [];

    const publishedAt = parsePublishedAt(row.發言日期, row.發言時間);
    const summary = row.說明?.trim();
    return [{
      id: `twse-action-${stableId(`${symbol}|${publishedAt}|${title}`)}`,
      companySymbol: `${symbol}.TW`,
      market: "TW",
      companyName,
      actionType: classifyAction(title, summary ?? ""),
      title,
      summary,
      effectiveDate: row.事實發生日 ? parseRocDate(row.事實發生日) : undefined,
      publishedAt,
      observedAt,
      knownAt: publishedAt,
      sourceId: twseSource.id,
      sourceUrl: TWSE_ACTIONS_URL,
      qualityStatus: "verified",
      metadata: {
        reportDate: row.出表日期 ? parseRocDate(row.出表日期) : undefined,
        officialDataset: "t187ap04_L",
      },
    }];
  });
}

export async function fetchTwseDailyPrices() {
  const rows = await fetchJson<TwsePriceRow[]>(TWSE_PRICES_URL);
  const fetchedAt = new Date().toISOString();

  return rows.flatMap((row) => {
    const code = row.Code?.trim();
    const close = parsePositiveNumber(row.ClosingPrice);
    if (!code || !/^\d{4}$/.test(code) || !close || !row.Date) return [];

    return [{
      symbol: `${code}.TW`,
      market: "TW",
      price_date: parseRocDate(row.Date),
      open: parsePositiveNumber(row.OpeningPrice),
      high: parsePositiveNumber(row.HighestPrice),
      low: parsePositiveNumber(row.LowestPrice),
      close,
      adj_close: close,
      volume: parsePositiveNumber(row.TradeVolume),
      provider: twseSource.id,
      source_url: TWSE_PRICES_URL,
      fetched_at: fetchedAt,
      quality_status: "verified",
      verified_at: fetchedAt,
      verification_provider: twseSource.id,
      updated_at: fetchedAt,
    }];
  });
}

export async function syncTwseResearchData(options?: {
  dryRun?: boolean;
  includeActions?: boolean;
  includePrices?: boolean;
}) {
  const dryRun = options?.dryRun ?? true;
  const includeActions = options?.includeActions ?? true;
  const includePrices = options?.includePrices ?? true;
  const [actions, prices] = await Promise.all([
    includeActions ? fetchTwseCompanyActions() : Promise.resolve([]),
    includePrices ? fetchTwseDailyPrices() : Promise.resolve([]),
  ]);

  const dates = [...new Set([
    ...actions.map((item) => item.publishedAt.slice(0, 10)),
    ...prices.map((item) => item.price_date),
  ])].sort();

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      source: twseSource.name,
      actionCount: actions.length,
      priceCount: prices.length,
      dates,
      actionSamples: actions.slice(0, 3),
      priceSamples: prices.slice(0, 3),
    };
  }

  await upsertResearchSources([twseSource]);
  const actionResult = await upsertCompanyActions(actions);
  const supabase = getSupabaseAdmin();
  const { error: priceError } = await supabase
    .from("stock_prices")
    .upsert(prices, { onConflict: "symbol,market,price_date" });
  if (priceError) throw priceError;

  return {
    ok: true,
    dryRun: false,
    source: twseSource.name,
    actionCount: actionResult.count,
    priceCount: prices.length,
    dates,
  };
}
