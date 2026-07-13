import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  fetchTwseInstitutionalValueFlow,
  type TwseInstitutionalValueFlow,
} from "@/lib/research-data/twse";
import { fetchTpexInstitutionalValueFlow } from "@/lib/research-data/tpex";

function mergeInstitutionalValueFlows(
  ...groups: TwseInstitutionalValueFlow[][]
): TwseInstitutionalValueFlow[] {
  const merged = new Map<string, TwseInstitutionalValueFlow>();
  for (const item of groups.flat()) {
    const key = `${item.tradeDate}|${item.label}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      continue;
    }
    merged.set(key, {
      ...existing,
      buyAmountTwd: existing.buyAmountTwd + item.buyAmountTwd,
      sellAmountTwd: existing.sellAmountTwd + item.sellAmountTwd,
      netAmountTwd: existing.netAmountTwd + item.netAmountTwd,
      fetchedAt: existing.fetchedAt > item.fetchedAt ? existing.fetchedAt : item.fetchedAt,
    });
  }
  return [...merged.values()].sort((a, b) =>
    a.tradeDate.localeCompare(b.tradeDate) || a.label.localeCompare(b.label));
}

export async function fetchTwInstitutionalValueFlowToday(): Promise<TwseInstitutionalValueFlow[]> {
  const [twse, tpex] = await Promise.all([
    fetchTwseInstitutionalValueFlow().catch(() => []),
    fetchTpexInstitutionalValueFlow().catch(() => []),
  ]);
  return mergeInstitutionalValueFlows(twse, tpex);
}

async function upsertInstitutionalValueFlows(flows: TwseInstitutionalValueFlow[]) {
  if (flows.length === 0) return { count: 0 };
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("tw_institutional_value_flows")
    .upsert(
      flows.map((flow) => ({
        trade_date: flow.tradeDate,
        label: flow.label,
        buy_amount_twd: flow.buyAmountTwd,
        sell_amount_twd: flow.sellAmountTwd,
        net_amount_twd: flow.netAmountTwd,
        provider: "twse-tpex-official",
        source_url: flow.sourceUrl,
        fetched_at: flow.fetchedAt,
        quality_status: "verified",
        verified_at: flow.fetchedAt,
        verification_provider: "twse-tpex-official",
        updated_at: flow.fetchedAt,
      })),
      { onConflict: "trade_date,label" },
    );
  if (error) throw error;
  return { count: flows.length };
}

export async function syncTwInstitutionalValueFlow(options?: { dryRun?: boolean }) {
  const dryRun = options?.dryRun ?? true;
  const flows = await fetchTwInstitutionalValueFlowToday();

  if (dryRun) {
    return { ok: true, dryRun: true, flowCount: flows.length, flows };
  }
  if (flows.length === 0) {
    return { ok: true, dryRun: false, flowCount: 0 };
  }
  const { count } = await upsertInstitutionalValueFlows(flows);
  return { ok: true, dryRun: false, flowCount: count };
}

function eachCalendarDate(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return dates;
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// TWSE's BFI82U endpoint supports real historical date queries (confirmed
// live), but TPEx's tpex_3insti_summary does not (it always returns the
// latest day regardless of any date parameter). So historical backfill can
// only recover the TWSE (上市) leg for past dates -- TPEx (上櫃) contribution
// stays absent for backfilled days, same honesty policy as everywhere else
// in this codebase (missing data is missing, not estimated).
export async function backfillTwseInstitutionalValueFlow(options: {
  startDate: string;
  endDate: string;
  dryRun?: boolean;
}) {
  const dryRun = options.dryRun ?? true;
  const dates = eachCalendarDate(options.startDate, options.endDate);
  const perDate = await Promise.all(dates.map(async (date) => {
    try {
      return await fetchTwseInstitutionalValueFlow({ date });
    } catch {
      return [];
    }
  }));
  const flows = perDate.flat();

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      requestedDates: dates.length,
      tradingDaysFound: perDate.filter((rows) => rows.length > 0).length,
      flowCount: flows.length,
      flows,
    };
  }
  const { count } = await upsertInstitutionalValueFlows(flows);
  return {
    ok: true,
    dryRun: false,
    requestedDates: dates.length,
    tradingDaysFound: perDate.filter((rows) => rows.length > 0).length,
    flowCount: count,
  };
}
