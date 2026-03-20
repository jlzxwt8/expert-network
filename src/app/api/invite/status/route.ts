import { NextRequest, NextResponse } from "next/server";
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
      select: { inviteCode: true },
    });

    return NextResponse.json({ hasInvite: !!user?.inviteCode });
  } catch (error) {
    console.error("[invite/status]", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
