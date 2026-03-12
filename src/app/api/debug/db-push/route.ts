import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const results: string[] = [];

  try {
    const existing = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const tableNames = existing.map((t) => t.tablename);
    results.push(`Existing tables: ${tableNames.join(", ")}`);

    // Create ExpertDomain if missing
    if (!tableNames.includes("ExpertDomain")) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ExpertDomain" (
          "id" TEXT NOT NULL,
          "expertId" TEXT NOT NULL,
          "domain" TEXT NOT NULL,
          CONSTRAINT "ExpertDomain_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ExpertDomain_expertId_domain_key"
        ON "ExpertDomain"("expertId", "domain")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ExpertDomain_expertId_idx"
        ON "ExpertDomain"("expertId")
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ExpertDomain"
        ADD CONSTRAINT "ExpertDomain_expertId_fkey"
        FOREIGN KEY ("expertId") REFERENCES "Expert"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      results.push("Created ExpertDomain table with indexes and FK");
    }

    // Add any missing columns to existing tables
    const alterations = [
      { table: "Expert", column: "weeklySchedule", type: "JSONB" },
      { table: "Expert", column: "priceOnlineCents", type: "INTEGER" },
      { table: "Expert", column: "priceOfflineCents", type: "INTEGER" },
      { table: "Expert", column: "currency", type: "TEXT DEFAULT 'SGD'" },
      { table: "Expert", column: "stripeAccountId", type: "TEXT" },
      { table: "Expert", column: "servicesOffered", type: "JSONB" },
      { table: "Booking", column: "offlineAddress", type: "TEXT" },
      { table: "Booking", column: "cancelledBy", type: "TEXT" },
      { table: "Booking", column: "cancelReason", type: "TEXT" },
    ];

    for (const { table, column, type } of alterations) {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${type}`
        );
        results.push(`${table}.${column}: ensured`);
      } catch (e: unknown) {
        results.push(`${table}.${column}: ${(e as Error).message}`);
      }
    }

    // Verify all tables
    for (const t of ["User", "Expert", "Booking", "AvailableSlot", "Review", "ExpertDomain"]) {
      try {
        const count = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
          `SELECT COUNT(*) as c FROM "${t}"`
        );
        results.push(`${t}: ${count[0]?.c ?? 0} rows`);
      } catch (e: unknown) {
        results.push(`${t}: ERROR - ${(e as Error).message}`);
      }
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
