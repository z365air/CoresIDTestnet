"use client";

import { QueryClient } from "@tanstack/react-query";
import {
  cookieStorage,
  createConfig,
  createStorage,
  http,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  // Allow EIP-6963 discovery so injected wallets (Rabby, MetaMask, ...) appear.
  multiInjectedProviderDiscovery: true,
  connectors: [
    baseAccount({
      appName: "Base Cores ID",
      appLogoUrl: "https://coresid.vercel.app/baselogomid.png",
    }),
    injected({ shimDisconnect: true }),
  ],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [baseSepolia.id]: http(),
  },
});

export const queryClient = new QueryClient();

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
