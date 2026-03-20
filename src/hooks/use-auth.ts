"use client";

import { useSession } from "next-auth/react";

import { useTelegram } from "@/components/telegram-provider";

interface AuthState {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  } | null;
  status: "loading" | "authenticated" | "unauthenticated";
  isTelegram: boolean;
}

/**
 * Unified auth hook — Telegram auth is handled globally by TelegramProvider,
 * which sets a NextAuth session cookie. After that, useSession() works for both
 * Telegram and web users.
 */
export function useAuth(): AuthState {
  const { isTelegram, ready, authDone } = useTelegram();
  const { data: session, status: nextAuthStatus } = useSession();

  if (!ready) {
    return { user: null, status: "loading", isTelegram: false };
  }

  if (isTelegram) {
    if (!authDone) {
      return { user: null, status: "loading", isTelegram: true };
    }
    if (nextAuthStatus === "authenticated" && session?.user) {
      return {
        user: {
          id: (session.user as { id?: string }).id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          role: (session.user as { role?: string }).role,
        },
        status: "authenticated",
        isTelegram: true,
      };
    }
    // Auth done but session not yet refreshed — still counts as authenticated
    // since the cookie was set; useSession may need a page reload to pick it up
    return { user: null, status: "authenticated", isTelegram: true };
  }

  // Web: standard NextAuth
  if (nextAuthStatus === "loading") {
    return { user: null, status: "loading", isTelegram: false };
  }
  if (nextAuthStatus === "authenticated" && session?.user) {
    return {
      user: {
        id: (session.user as { id?: string }).id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: (session.user as { role?: string }).role,
      },
      status: "authenticated",
      isTelegram: false,
    };
  }
  return { user: null, status: "unauthenticated", isTelegram: false };
}
