"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { TelegramProvider } from "@/components/telegram-provider";
import { TonConnectProvider } from "@/components/ton-connect-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TonConnectProvider>
        <TelegramProvider>{children}</TelegramProvider>
      </TonConnectProvider>
    </SessionProvider>
  );
}
