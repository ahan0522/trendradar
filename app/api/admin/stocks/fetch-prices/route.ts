import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { fetchAndMaybeUpsertStockPrices } from "@/lib/signals/price-fetcher";
import type { MarketCode } from "@/types/signals";

type RequestBody = {
  symbols?: Array<{
    symbol?: string;
    market?: MarketCode;
  }>;
  date?: string;
  dryRun?: boolean;
  lookbackDays?: number;
};

const supportedMarkets: MarketCode[] = ["US", "TW", "KR", "JP", "GLOBAL"];

function normalizeBody(body: RequestBody) {
  const date = body.date?.trim();
  if (!date) throw new Error("Missing date. Use YYYY-MM-DD.");

  const symbols = body.symbols ?? [];
  if (symbols.length === 0) throw new Error("Missing symbols.");

  return symbols.map((item) => {
    const symbol = item.symbol?.trim();
    const market = item.market;

    if (!symbol) throw new Error("Each symbol item needs a symbol.");
    if (!market || !supportedMarkets.includes(market)) {
      throw new Error(`Unsupported market for ${symbol}: ${market ?? "missing"}`);
    }

    return { symbol, market, date };
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as RequestBody;
    const requests = normalizeBody(body);
    const result = await fetchAndMaybeUpsertStockPrices(requests, {
      dryRun: body.dryRun ?? true,
      lookbackDays: body.lookbackDays,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
