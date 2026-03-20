"use client";

import { type ReactNode } from "react";

import { SessionProvider } from "next-auth/react";

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
