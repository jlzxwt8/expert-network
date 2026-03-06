import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";

const VALID_ROLES: UserRole[] = ["EXPERT", "FOUNDER", "ADMIN"];

function parseRole(value: unknown): UserRole | null {
  return typeof value === "string" && VALID_ROLES.includes(value as UserRole)
    ? (value as UserRole)
    : null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { expert: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("[user GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const nickName =
      body.nickName !== undefined
        ? typeof body.nickName === "string"
          ? body.nickName
          : null
        : undefined;
    const role = parseRole(body.role);

    const updateData: { nickName?: string | null; role?: UserRole } = {};
    if (nickName !== undefined) updateData.nickName = nickName;
    if (role !== null) updateData.role = role;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update (nickName, role)" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      include: { expert: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("[user PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
