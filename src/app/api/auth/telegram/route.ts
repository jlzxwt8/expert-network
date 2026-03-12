import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateAndParseTelegramInitData } from "@/lib/telegram-server";
import { encode } from "next-auth/jwt";

export async function POST(request: Request) {
  try {
    const { initData } = await request.json();
    if (!initData) {
      return NextResponse.json({ error: "Missing initData" }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: "Telegram not configured" },
        { status: 500 }
      );
    }

    const tgUser = await validateAndParseTelegramInitData(initData, botToken);
    const tgId = String(tgUser.id);
    const tgUsername = tgUser.username?.trim() || null;

    // Try to find existing user by telegramId
    let user = await prisma.user.findUnique({
      where: { telegramId: tgId },
      include: { expert: true },
    });

    // If telegramId is not linked yet, try to map by telegramUsername
    if (!user && tgUsername) {
      const byUsername = await prisma.user.findFirst({
        where: { telegramUsername: tgUsername },
        include: { expert: true },
      });

      // Only link if the matched account is unlinked or already linked to this same Telegram ID
      if (byUsername && (!byUsername.telegramId || byUsername.telegramId === tgId)) {
        user = await prisma.user.update({
          where: { id: byUsername.id },
          data: {
            telegramId: tgId,
            telegramUsername: tgUsername,
            image: byUsername.image ?? tgUser.photoUrl,
          },
          include: { expert: true },
        });
      }
    }

    if (!user) {
      const name = [tgUser.firstName, tgUser.lastName]
        .filter(Boolean)
        .join(" ");
      user = await prisma.user.create({
        data: {
          name,
          telegramId: tgId,
          telegramUsername: tgUsername,
          image: tgUser.photoUrl,
        },
        include: { expert: true },
      });
    } else if (!user.telegramId || user.telegramUsername !== tgUsername) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          telegramId: tgId,
          telegramUsername: tgUsername,
        },
        include: { expert: true },
      });
    }

    // Create a NextAuth-compatible JWT
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Auth secret not configured" },
        { status: 500 }
      );
    }

    const token = await encode({
      secret,
      token: {
        sub: user.id,
        name: user.name ?? undefined,
        email: user.email ?? undefined,
        picture: user.image ?? undefined,
        role: user.role,
        nickName: user.nickName ?? undefined,
      },
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        hasExpert: !!user.expert,
      },
    });

    // Set the NextAuth session cookie so subsequent requests are authenticated
    const cookieName =
      process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token";

    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none", // required for Telegram WebView
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[auth/telegram POST]", message, error);
    return NextResponse.json(
      { error: "Authentication failed", detail: message },
      { status: 401 }
    );
  }
}
