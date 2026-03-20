import { type NextRequest } from "next/server";

import { jwtVerify } from "jose";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  validateAndParseTelegramInitData,
  parseTelegramInitDataUnsafe,
} from "@/lib/telegram-server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "wechat-fallback-secret"
);

/**
 * Resolve current user ID. Priority:
 * 1. x-wechat-token header (JWT from WeChat Mini Program)
 * 2. x-telegram-init-data header (validated, then unsafe-parsed fallback)
 * 3. tg_user_id cookie
 * 4. NextAuth session
 */
export async function resolveUserId(request?: NextRequest): Promise<string | null> {
  // 1. WeChat Mini Program JWT
  const wxToken = request?.headers.get("x-wechat-token");
  if (wxToken) {
    try {
      const { payload } = await jwtVerify(wxToken, JWT_SECRET);
      if (payload.sub && payload.type === "wechat") {
        const exists = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true },
        });
        if (exists) return payload.sub;
      }
    } catch (err) {
      console.warn("[resolveUserId] wechat token verification failed:", err instanceof Error ? err.message : err);
    }
  }

  // 2. Telegram Mini App initData
  const initData = request?.headers.get("x-telegram-init-data");
  if (initData) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (botToken) {
      try {
        const tgUser = await validateAndParseTelegramInitData(initData, botToken);
        const found = await findOrLinkTelegramUser(String(tgUser.id), tgUser.username);
        if (found) return found;
      } catch (err) {
        console.warn("[resolveUserId] initData validation failed:", err instanceof Error ? err.message : err);
      }
    }

    const tgUser = parseTelegramInitDataUnsafe(initData);
    if (tgUser) {
      const found = await findOrLinkTelegramUser(String(tgUser.id), tgUser.username);
      if (found) return found;
    }
  }

  // 3. Telegram cookie
  const tgUserId = request?.cookies.get("tg_user_id")?.value;
  if (tgUserId) {
    const exists = await prisma.user.findUnique({
      where: { id: tgUserId },
      select: { id: true },
    });
    if (exists) return tgUserId;
  }

  // 4. NextAuth session
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
