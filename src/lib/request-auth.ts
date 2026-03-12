import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Resolve current user ID from NextAuth session, with Telegram Mini App fallback.
 * Telegram fallback uses an httpOnly cookie set by /api/auth/telegram.
 */
export async function resolveUserId(request?: NextRequest): Promise<string | null> {
  const tgUserId = request?.cookies.get("tg_user_id")?.value;
  if (tgUserId) return tgUserId;

  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;

  return null;
}
