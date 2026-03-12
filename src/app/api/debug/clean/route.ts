import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  const log: string[] = [];

  try {
    const tables = [
      "ExpertDomain",
      "AvailableSlot",
      "Review",
      "Booking",
      "Expert",
      "Account",
      "Session",
      "VerificationToken",
      "User",
    ];

    for (const table of tables) {
      const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
      log.push(`${table}: ${result} rows deleted`);
    }

    return NextResponse.json({ status: "ok", log });
  } catch (e: unknown) {
    return NextResponse.json({ status: "error", error: (e as Error).message, log }, { status: 500 });
  }
}
