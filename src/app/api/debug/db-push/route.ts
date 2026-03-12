import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const results: string[] = [];

  try {
    // Create tables by running raw SQL for any missing ones
    // Prisma's runtime client can create tables via $executeRawUnsafe

    // Check which tables exist
    const existing = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const tableNames = existing.map((t) => t.tablename);
    results.push(`Existing tables: ${tableNames.join(", ")}`);

    // If key tables are missing, we need schema push
    const required = ["User", "Expert", "Booking", "AvailableSlot", "Review", "ExpertDomain"];
    const missing = required.filter((t) => !tableNames.includes(t));

    if (missing.length === 0) {
      results.push("All required tables exist!");

      // Verify we can query each table
      for (const table of required) {
        try {
          const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "${table}"`);
          results.push(`${table}: OK (${JSON.stringify(count)})`);
        } catch (e: unknown) {
          results.push(`${table}: ERROR - ${(e as Error).message}`);
        }
      }
    } else {
      results.push(`Missing tables: ${missing.join(", ")}`);
      results.push("Run 'prisma db push' from a machine that can reach the database.");
    }

    return NextResponse.json({ status: "ok", results });
  } catch (e: unknown) {
    return NextResponse.json({
      status: "error",
      error: (e as Error).message,
      results,
    });
  }
}
