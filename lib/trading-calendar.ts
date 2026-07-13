// Shared trading-day rules for Taiwan (TWSE/TPEx) and the US (NYSE/NASDAQ).
//
// Why this exists: earlier ad-hoc testing of TWSE's BFI82U endpoint
// misjudged "no data returned" for a non-trading day as "this endpoint
// doesn't support historical queries" -- it just happened to be tested
// against a weekend. This module gives a single, official-source-backed
// answer to "is this a real trading day" so callers (backfill scripts,
// range loops, report generation) don't have to guess from HTTP responses.

const TWSE_HOLIDAY_SCHEDULE_URL = "https://www.twse.com.tw/holidaySchedule/holidaySchedule";

type TwseHolidayResponse = {
  stat?: string;
  data?: string[][]; // [date, name, description]
};

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

// TWSE's official holiday schedule mixes true non-trading entries (放假/無交易)
// with informational annotations for the trading days immediately before/
// after a holiday block (開始交易/最後交易) -- e.g. "農曆春節前最後交易日" is
// itself a real trading day, not a holiday. Only count an entry as a
// non-trading day when its text says so explicitly.
function isHolidayEntry(name: string, description: string): boolean {
  const text = `${name} ${description}`;
  if (/開始交易|最後交易/.test(text)) return false;
  if (/放假|無交易/.test(text)) return true;
  return false;
}

async function fetchTwseHolidayDates(year: number): Promise<Set<string>> {
  const url = `${TWSE_HOLIDAY_SCHEDULE_URL}?response=json&queryYear=${year}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "TrendRadar/1.0 research-data@trendradar",
    },
  });
  if (!response.ok) throw new Error(`TWSE holiday schedule request failed: ${response.status} ${url}`);
  const payload = await response.json() as TwseHolidayResponse;
  const dates = new Set<string>();
  for (const row of payload.data ?? []) {
    const [date, name, description] = row;
    if (date && isHolidayEntry(name ?? "", description ?? "")) dates.add(date);
  }
  return dates;
}

const twseHolidayCache = new Map<number, Promise<Set<string>>>();

function twseHolidaysForYear(year: number): Promise<Set<string>> {
  const cached = twseHolidayCache.get(year);
  if (cached) return cached;
  const promise = fetchTwseHolidayDates(year).catch((error) => {
    twseHolidayCache.delete(year); // allow a retry on the next call instead of caching a failure forever
    throw error;
  });
  twseHolidayCache.set(year, promise);
  return promise;
}

/**
 * True if `date` (YYYY-MM-DD) is a real TWSE/TPEx trading day: not a weekend,
 * and not on the official TWSE holiday schedule for that year. Falls back to
 * "assume trading day" (weekday check only) if the official schedule can't
 * be fetched -- callers already handle empty/missing data gracefully, so a
 * false positive here just costs one extra no-op request, while a false
 * negative would silently skip a real trading day.
 *
 * Known gap: this does NOT capture ad-hoc same-day/day-before market closures
 * (e.g. typhoon closures -- 2026-07-10 was closed for Typhoon Bawei but is
 * not on the annual holiday schedule, since that closure wasn't known until
 * the day before). No public TWSE API publishes a machine-readable
 * retrospective log of these. Callers must still treat an empty API response
 * on a nominally-"trading" day as "no data that day," not an error -- this
 * function narrows down *most* false assumptions, it doesn't eliminate them.
 */
export async function isTwTradingDay(date: string): Promise<boolean> {
  if (isWeekend(date)) return false;
  const year = Number(date.slice(0, 4));
  try {
    const holidays = await twseHolidaysForYear(year);
    return !holidays.has(date);
  } catch {
    return true;
  }
}

// US market holidays (NYSE and NASDAQ share the same schedule). Unlike
// Taiwan's lunar-calendar-based holidays, US market holidays are fixed years
// in advance by the exchanges and rarely change, so a maintained static
// table per year is the pragmatic choice here rather than scraping a page.
// Source: NYSE's official holiday/early-closing announcement for 2026.
// Update this table each year (typically announced in Q4 of the prior year).
const US_MARKET_HOLIDAYS: Record<number, string[]> = {
  2026: [
    "2026-01-01", // New Year's Day
    "2026-01-19", // Martin Luther King Jr. Day
    "2026-02-16", // Presidents' Day
    "2026-04-03", // Good Friday
    "2026-05-25", // Memorial Day
    "2026-06-19", // Juneteenth
    "2026-07-03", // Independence Day observed (July 4 falls on a Saturday)
    "2026-09-07", // Labor Day
    "2026-11-26", // Thanksgiving Day
    "2026-12-25", // Christmas Day
  ],
};

/**
 * True if `date` (YYYY-MM-DD) is a real NYSE/NASDAQ trading day. If no
 * holiday table exists for the given year, assumes trading day (weekday
 * check only) rather than blocking -- update `US_MARKET_HOLIDAYS` annually.
 */
export function isUsTradingDay(date: string): boolean {
  if (isWeekend(date)) return false;
  const year = Number(date.slice(0, 4));
  const holidays = US_MARKET_HOLIDAYS[year];
  if (!holidays) return true;
  return !holidays.includes(date);
}
