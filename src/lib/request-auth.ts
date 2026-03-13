import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  validateAndParseTelegramInitData,
  parseTelegramInitDataUnsafe,
} from "@/lib/telegram-server";

/**
 * Resolve current user ID. Priority:
 * 1. x-telegram-init-data header (validated, then unsafe-parsed fallback)
 * 2. tg_user_id cookie
 * 3. NextAuth session
 */
export async function resolveUserId(request?: NextRequest): Promise<string | null> {
  const initData = request?.headers.get("x-telegram-init-data");
  if (initData) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // Try validated path first
    if (botToken) {
      try {
        const tgUser = await validateAndParseTelegramInitData(initData, botToken);
        const found = await findOrLinkTelegramUser(String(tgUser.id), tgUser.username);
        if (found) return found;
      } catch (err) {
        console.warn("[resolveUserId] initData validation failed:", err instanceof Error ? err.message : err);
      }
    }

    // Fallback: parse without crypto validation
    const tgUser = parseTelegramInitDataUnsafe(initData);
    if (tgUser) {
      const found = await findOrLinkTelegramUser(String(tgUser.id), tgUser.username);
      if (found) return found;
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

    // Session is valid but user was deleted — re-create from session data
    try {
      const sessionUser = session.user as { id: string; name?: string; email?: string; image?: string };
      const recreated = await prisma.user.create({
        data: {
          id: sessionUser.id,
          name: sessionUser.name ?? null,
          email: sessionUser.email ?? null,
          image: sessionUser.image ?? null,
        },
      });
      return recreated.id;
    } catch {
      // Creation may fail if ID format is invalid or unique constraint
    }
  }

  return null;
}

async function findOrLinkTelegramUser(
  tgId: string,
  tgUsername?: string | null
): Promise<string | null> {
  let user = await prisma.user.findUnique({ where: { telegramId: tgId } });

  if (user) {
    // Keep telegramUsername in sync
    if (tgUsername && user.telegramUsername !== tgUsername) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { telegramUsername: tgUsername },
      });
    }
    return user.id;
  }

  if (tgUsername) {
    user = await prisma.user.findFirst({
      where: { telegramUsername: tgUsername },
    });
    if (user && (!user.telegramId || user.telegramId === tgId)) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { telegramId: tgId, telegramUsername: tgUsername },
      });
      return user.id;
    }
  }

  return null;
}
