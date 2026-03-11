"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { isTelegramMiniApp } from "@/lib/telegram";

interface TelegramContextValue {
  isTelegram: boolean;
  ready: boolean;
  /** Whether Telegram auth has completed (success or failure) */
  authDone: boolean;
}

const TelegramContext = createContext<TelegramContextValue>({
  isTelegram: false,
  ready: false,
  authDone: false,
});

export function useTelegram() {
  return useContext(TelegramContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TelegramContextValue>({
    isTelegram: false,
    ready: false,
    authDone: false,
  });

  const authenticateTelegram = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const webApp = (window as any).Telegram?.WebApp;
      const initData = webApp?.initData;
      if (!initData) return;

      await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
    } catch {
      // Auth failure is non-fatal; user can still browse
    }
  }, []);

  useEffect(() => {
    if (!isTelegramMiniApp()) {
      setState({ isTelegram: false, ready: true, authDone: true });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webApp = (window as any).Telegram?.WebApp;
    if (webApp) {
      webApp.ready();
      webApp.expand();
      setState({ isTelegram: true, ready: true, authDone: false });

      authenticateTelegram().then(() => {
        setState({ isTelegram: true, ready: true, authDone: true });
      });
    } else {
      setState({ isTelegram: false, ready: true, authDone: true });
    }
  }, [authenticateTelegram]);

  return (
    <TelegramContext.Provider value={state}>
      {children}
    </TelegramContext.Provider>
  );
}
