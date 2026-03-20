import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { telegramUsername: { not: null } },
        { telegramId: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      telegramId: true,
      telegramUsername: true,
      createdAt: true,
      expert: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ count: users.length, users });
}
