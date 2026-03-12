import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateAndParseTelegramInitData } from "@/lib/telegram-server";

/**
 * Resolve current user ID from NextAuth session, with Telegram Mini App fallback.
 * Telegram fallback uses an httpOnly cookie set by /api/auth/telegram.
 */
export async function resolveUserId(request?: NextRequest): Promise<string | null> {
  const initData = request?.headers.get("x-telegram-init-data");
  if (initData) {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const tgUser = await validateAndParseTelegramInitData(initData, botToken);
        const tgId = String(tgUser.id);
        const tgUsername = tgUser.username?.trim() || null;

        let user = await prisma.user.findUnique({ where: { telegramId: tgId } });
        if (!user && tgUsername) {
          user = await prisma.user.findFirst({ where: { telegramUsername: tgUsername } });
          if (user && (!user.telegramId || user.telegramId === tgId)) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { telegramId: tgId, telegramUsername: tgUsername },
            });
          }
        }
        if (user) return user.id;
      }
    } catch {
      // Ignore header validation errors and continue with cookie/session fallback
    }
  }

  const tgUserId = request?.cookies.get("tg_user_id")?.value;
  if (tgUserId) {
    const exists = await prisma.user.findUnique({
      where: { id: tgUserId },
      select: { id: true },
    });
    if (exists) return tgUserId;
  }

  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const exists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });
    if (exists) return session.user.id;
  }

  return null;
}
