import { http } from "wagmi";
import { defineChain } from "viem";
import { bsc, bscTestnet } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const isLocal = process.env.NEXT_PUBLIC_USE_LOCAL === "true";

const hardhatLocal = defineChain({
  id: 31337,
  name: "Hardhat Local",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
  testnet: true,
});

const chains = isLocal ? [hardhatLocal, bsc, bscTestnet] as const : [bsc, bscTestnet] as const;

export const config = getDefaultConfig({
  appName: "Motshelo",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "PLACEHOLDER_PROJECT_ID",
  chains,
  transports: {
    [hardhatLocal.id]: http("http://127.0.0.1:8545"),
    [bsc.id]: http("https://bsc-dataseed1.binance.org"),
    [bscTestnet.id]: http("https://data-seed-prebsc-1-s1.bnbchain.org:8545"),
  },
  ssr: true,
});
