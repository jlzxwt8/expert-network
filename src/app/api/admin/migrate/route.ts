import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/request-auth";

const MIGRATIONS = [
  `ALTER TABLE "Expert" ADD COLUMN IF NOT EXISTS "stripeAccountStatus" TEXT DEFAULT 'none'`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "wechatOpenId" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "wechatUnionId" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_wechatOpenId_key" ON "User"("wechatOpenId")`,
  // Reset test-mode Stripe Connected Accounts so experts re-KYC in live mode
  `UPDATE "Expert" SET "stripeAccountId" = NULL, "stripeAccountStatus" = 'none' WHERE "stripeAccountId" IS NOT NULL`,
  `ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "expertSuggestion" TEXT`,
  `ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "suggestionAt" TIMESTAMP`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteCode" TEXT`,
  `CREATE TABLE IF NOT EXISTS "InvitationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 10,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "note" TEXT,
    "expiresAt" TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvitationCode_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "InvitationCode_code_key" ON "InvitationCode"("code")`,
];

/**
 * POST /api/admin/migrate
 * Runs pending schema migrations. Protected — only admin users can call this.
 * Remove this endpoint after all migrations are applied.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const results: string[] = [];

    for (const sql of MIGRATIONS) {
      try {
        await prisma.$executeRawUnsafe(sql);
        results.push(`OK: ${sql.slice(0, 80)}...`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push(`ERR: ${sql.slice(0, 60)}... → ${msg}`);
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin/migrate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
