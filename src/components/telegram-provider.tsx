"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useSession } from "next-auth/react";

import { isTelegramMiniApp } from "@/lib/telegram";

interface TelegramContextValue {
  isTelegram: boolean;
  ready: boolean;
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
  const { update: refreshSession } = useSession();
  const refreshRef = useRef(refreshSession);
  refreshRef.current = refreshSession;

  const [state, setState] = useState<TelegramContextValue>({
    isTelegram: false,
    ready: false,
    authDone: false,
  });
  const didAuth = useRef(false);

  useEffect(() => {
    if (didAuth.current) return;

    if (!isTelegramMiniApp()) {
      setState({ isTelegram: false, ready: true, authDone: true });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webApp = (window as any).Telegram?.WebApp;
    if (!webApp) {
      setState({ isTelegram: false, ready: true, authDone: true });
      return;
    }

    didAuth.current = true;
    webApp.ready();
    webApp.expand();
    setState({ isTelegram: true, ready: true, authDone: false });

    (async () => {
      try {
        const initData = webApp.initData;
        if (!initData) return;

        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });

        if (res.ok) {
          await refreshRef.current();
        }
      } catch {
        // Auth failure is non-fatal
      } finally {
        setState({ isTelegram: true, ready: true, authDone: true });
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TelegramContext.Provider value={state}>
      {children}
    </TelegramContext.Provider>
  );
}
