"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { TelegramProvider } from "@/components/telegram-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TelegramProvider>{children}</TelegramProvider>
    </SessionProvider>
  );
}
