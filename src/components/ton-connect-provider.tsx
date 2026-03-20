"use client";

import { type ReactNode } from "react";

import { TonConnectUIProvider } from "@tonconnect/ui-react";

const MANIFEST_URL = "https://expert-network.vercel.app/tonconnect-manifest.json";

export function TonConnectProvider({ children }: { children: ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      {children}
    </TonConnectUIProvider>
  );
}
