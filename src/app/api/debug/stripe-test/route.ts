import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";

export async function GET() {
  try {
    const stripe = getStripeServer();
    const balance = await stripe.balance.retrieve();

    return NextResponse.json({
      ok: true,
      currency: balance.available?.[0]?.currency,
      nodeVersion: process.version,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      nodeVersion: process.version,
    });
  }
}
