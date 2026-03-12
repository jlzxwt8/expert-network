import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        nickName: true,
        email: true,
        role: true,
        telegramUsername: true,
        expert: {
          select: {
            id: true,
            isPublished: true,
            onboardingStep: true,
            bio: true,
            sessionType: true,
            priceOnlineCents: true,
            priceOfflineCents: true,
            domains: { select: { domain: true } },
          },
        },
      },
    });

    return NextResponse.json({ count: users.length, users });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
