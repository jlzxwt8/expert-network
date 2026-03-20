import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/request-auth";

export async function requireAdmin(
  request: NextRequest
): Promise<{ userId: string } | NextResponse> {
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

  return { userId };
}

export function isErrorResponse(
  result: { userId: string } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
