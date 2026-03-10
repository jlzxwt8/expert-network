"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isTelegramMiniApp } from "@/lib/telegram";

interface TelegramContextValue {
  isTelegram: boolean;
  ready: boolean;
}

const TelegramContext = createContext<TelegramContextValue>({
  isTelegram: false,
  ready: false,
});

export function useTelegram() {
  return useContext(TelegramContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TelegramContextValue>({
    isTelegram: false,
    ready: false,
  });

  useEffect(() => {
    if (!isTelegramMiniApp()) {
      setState({ isTelegram: false, ready: true });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webApp = (window as any).Telegram?.WebApp;
    if (webApp) {
      webApp.ready();
      webApp.expand();
      setState({ isTelegram: true, ready: true });
    } else {
      setState({ isTelegram: false, ready: true });
    }
  }, []);

  return (
    <TelegramContext.Provider value={state}>
      {children}
    </TelegramContext.Provider>
  );
}
