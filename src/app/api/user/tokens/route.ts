import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const ledger = await prisma.tokenLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        createdAt: true,
        bookingId: true,
      },
    });

    const redemptionRate = { tokensPerSGD: 100 };
    const redeemableValue = Math.floor(user.tokenBalance / 100);

    return NextResponse.json({
      balance: user.tokenBalance,
      redeemableValueSGD: redeemableValue,
      redemptionRate,
      ledger,
    });
  } catch (error) {
    console.error("[user/tokens]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
