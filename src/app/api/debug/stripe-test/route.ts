import { NextResponse } from "next/server";

import { retrieveBalance } from "@/lib/stripe";

export async function GET() {
  try {
    const balance = await retrieveBalance();
    const available = balance.available as { currency: string }[] | undefined;

    return NextResponse.json({
      ok: true,
      currency: available?.[0]?.currency,
      nodeVersion: process.version,
      method: "direct-fetch",
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      nodeVersion: process.version,
    });
  }
}
