import { NextResponse } from "next/server";

/**
 * Public liveness check for monitoring and CI (e.g. post-deploy smoke on Preview).
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: "expert-network" });
}
