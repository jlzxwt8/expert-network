"use client";

import { type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { WagmiProvider } from "wagmi";

import { TelegramProvider } from "@/components/telegram-provider";
import { TonConnectProvider } from "@/components/ton-connect-provider";
import { wagmiConfig } from "@/lib/wagmi-config";

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <TonConnectProvider>
            <TelegramProvider>{children}</TelegramProvider>
          </TonConnectProvider>
        </SessionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
