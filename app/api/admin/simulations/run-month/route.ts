import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin-auth";
import { getCurrentMonthlySignals } from "@/lib/signals/monthly-signals";

type RunMonthBody = {
  year?: number;
  month?: number;
};

function lastDayOfMonth(year: number, month: number) {
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

function isValidMonth(year: unknown, month: unknown) {
  return Number.isInteger(year) && Number.isInteger(month) && Number(year) >= 2000 && Number(year) <= 2100 && Number(month) >= 1 && Number(month) <= 12;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) return unauthorized;

  let body: RunMonthBody;
  try {
    body = (await request.json()) as RunMonthBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValidMonth(body.year, body.month)) {
    return NextResponse.json({ ok: false, error: "Provide numeric year and month." }, { status: 400 });
  }

  const year = Number(body.year);
  const month = Number(body.month);
  const asOfDate = lastDayOfMonth(year, month);

  try {
    const signals = await getCurrentMonthlySignals(asOfDate);
    return NextResponse.json({
      ok: true,
      mode: "time_machine_monthly_simulation",
      year,
      month,
      asOfDate,
      rule: "Only articles with published_at <= asOfDate are used. Future outcome data is not used during signal generation.",
      signalCount: signals.length,
      outcomeStatus: "pending",
      signals: signals.map((signal) => ({
        ...signal,
        validation: {
          outcome: "pending",
          reason: "Backtest requires future stock price coverage after this asOfDate.",
        },
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to run monthly simulation.",
      },
      { status: 500 },
    );
  }
}
