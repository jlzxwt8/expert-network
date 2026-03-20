import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/request-auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function generateCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export async function GET(request: NextRequest) {
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

    const codes = await prisma.invitationCode.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(codes);
  } catch (error) {
    console.error("[admin/invite-codes GET]", error);
    return NextResponse.json({ error: "Failed to fetch codes" }, { status: 500 });
  }
}

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

    const body = await request.json().catch(() => ({}));
    const maxUses = typeof body.maxUses === "number" ? body.maxUses : 10;
    const note = typeof body.note === "string" ? body.note : null;
    const count = typeof body.count === "number" ? Math.min(body.count, 50) : 1;

    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = await prisma.invitationCode.create({
        data: {
          code: generateCode(),
          maxUses,
          note,
          createdBy: userId,
        },
      });
      codes.push(code);
    }

    return NextResponse.json(codes);
  } catch (error) {
    console.error("[admin/invite-codes POST]", error);
    return NextResponse.json({ error: "Failed to create codes" }, { status: 500 });
  }
}
