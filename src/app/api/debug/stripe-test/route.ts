import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" });
  }

  // Test 1: Direct fetch to Stripe API (bypass SDK entirely)
  try {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    const data = await res.json();
    const fetchOk = res.ok;

    // Test 2: Stripe SDK
    let sdkOk = false;
    let sdkError = "";
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(key, { timeout: 15_000, maxNetworkRetries: 1 });
      await stripe.balance.retrieve();
      sdkOk = true;
    } catch (e) {
      sdkError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({
      keyPrefix: key.substring(0, 12) + "...",
      fetchTest: { ok: fetchOk, currency: data?.available?.[0]?.currency },
      sdkTest: { ok: sdkOk, error: sdkError || undefined },
      nodeVersion: process.version,
    });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
