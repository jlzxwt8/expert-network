"use client";

import { useSession } from "next-auth/react";
import { useTelegram } from "@/components/telegram-provider";
import { useTelegramAuth } from "./use-telegram-auth";

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
 * Unified auth hook — uses Telegram auth inside Mini App,
 * NextAuth on the web. Both result in a NextAuth session cookie,
 * so after initial Telegram auth, useSession() works everywhere.
 */
export function useAuth(): AuthState {
  const { isTelegram, ready } = useTelegram();
  const tgAuth = useTelegramAuth();
  const { data: session, status: nextAuthStatus } = useSession();

  if (!ready) {
    return { user: null, status: "loading", isTelegram: false };
  }

  // Inside Telegram: wait for Telegram auth to complete, then rely on session
  if (isTelegram) {
    if (tgAuth.status === "loading") {
      return { user: null, status: "loading", isTelegram: true };
    }
    // After Telegram auth sets the cookie, NextAuth session picks it up
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
    // Telegram auth completed but session not yet refreshed
    if (tgAuth.status === "authenticated") {
      return { user: null, status: "authenticated", isTelegram: true };
    }
    return { user: null, status: "unauthenticated", isTelegram: true };
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
