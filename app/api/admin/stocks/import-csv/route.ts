import { NextRequest, NextResponse } from "next/server";
import { parseStockPriceCsv, upsertStockPrices } from "@/lib/signals/stock-prices";
import { requireAdminSecret } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as { csv?: string };
    const prices = parseStockPriceCsv(body.csv ?? "");
    const result = await upsertStockPrices(prices);
    return NextResponse.json({ ok: true, imported: result.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
