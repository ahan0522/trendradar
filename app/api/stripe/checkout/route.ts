import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Creates a Stripe Checkout Session for the single subscription plan
// configured via STRIPE_PRICE_ID. Callers must already know the
// authenticated user's id/email (this route does not resolve a session
// itself) -- once account pages exist, they call this with the signed-in
// user's id and email.
export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !process.env.STRIPE_PRICE_ID) {
    return NextResponse.json(
      { ok: false, error: "Stripe is not configured yet (missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID)." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const email = typeof body?.email === "string" ? body.email : null;
  if (!userId || !email) {
    return NextResponse.json({ ok: false, error: "userId and email are required." }, { status: 400 });
  }

  const stripe = getStripe();
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle<{ stripe_customer_id: string }>();

  const customerId = existing?.stripe_customer_id ?? (await stripe.customers.create({
    email,
    metadata: { userId },
  })).id;

  const origin = request.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/brief?checkout=success`,
    cancel_url: `${origin}/brief?checkout=cancelled`,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
  });

  return NextResponse.json({ ok: true, url: session.url });
}
