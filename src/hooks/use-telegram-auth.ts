"use client";

import { useEffect, useState, useCallback } from "react";

import { useTelegram } from "@/components/telegram-provider";

interface TelegramAuthState {
  status: "loading" | "authenticated" | "unauthenticated";
  error?: string;
}

/**
 * Authenticates the user via Telegram initData when running inside a Mini App.
 * Sets the NextAuth session cookie server-side so subsequent useSession() calls
 * pick up the authenticated session.
 */
export function useTelegramAuth() {
  const { isTelegram, ready } = useTelegram();
  const [state, setState] = useState<TelegramAuthState>({
    status: "loading",
  });

  const authenticate = useCallback(async () => {
    if (!isTelegram) {
      setState({ status: "unauthenticated" });
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const webApp = (window as any).Telegram?.WebApp;
      const initData = webApp?.initData;
      if (!initData) {
        setState({ status: "unauthenticated", error: "No initData" });
        return;
      }

      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setState({
          status: "unauthenticated",
          error: data.detail || "Auth failed",
        });
        return;
      }

      setState({ status: "authenticated" });
    } catch (err) {
      setState({
        status: "unauthenticated",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [isTelegram]);

  useEffect(() => {
    if (ready) {
      authenticate();
    }
  }, [ready, authenticate]);

  return state;
}
