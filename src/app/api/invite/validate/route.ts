import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/request-auth";

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

    if (!code) {
      return NextResponse.json({ error: "Invitation code is required" }, { status: 400 });
    }

    const invitation = await prisma.invitationCode.findUnique({
      where: { code },
    });

    if (!invitation || !invitation.isActive) {
      return NextResponse.json({ error: "Invalid invitation code" }, { status: 404 });
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invitation code has expired" }, { status: 410 });
    }

    if (invitation.usedCount >= invitation.maxUses) {
      return NextResponse.json({ error: "This invitation code has reached its usage limit" }, { status: 410 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { inviteCode: code },
      }),
      prisma.invitationCode.update({
        where: { id: invitation.id },
        data: { usedCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[invite/validate]", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
