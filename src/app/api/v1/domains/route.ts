import { NextResponse } from "next/server";
import { DOMAINS } from "@/lib/constants";

export async function GET() {
  return NextResponse.json({ domains: DOMAINS });
}
