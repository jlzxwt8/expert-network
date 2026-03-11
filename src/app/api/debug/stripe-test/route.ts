import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" });
  }

  try {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const data = await res.json();

    return NextResponse.json({
      keyPrefix: key.substring(0, 12) + "...",
      fetchTest: { ok: res.ok, currency: data?.available?.[0]?.currency },
      nodeVersion: process.version,
    });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
