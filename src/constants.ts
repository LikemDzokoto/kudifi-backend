// imports
import { defineChain, NATIVE_TOKEN_ADDRESS } from "thirdweb";

export const supportedTokens = [
  {
    name: "ApeCoin",
    addess: NATIVE_TOKEN_ADDRESS,
    symbol: "APE",
    decimals: 18,
  },
  {
    name: "Tether USD",
    addess: "0xb56415964d3F47fd3390484676e4f394d198374a", // USDT
    symbol: "USDT",
    decimals: 6,
  },
  {
    name: "USD Coin",
    addess: "0xE0356B8aD7811dC3e4d61cFD6ac7653e0D31b096", // USDC
    symbol: "USDC",
    decimals: 6,
  },
] as const;

export const supportedTokensMap = {
  APE: supportedTokens[0],
  USDT: supportedTokens[1],
  USDC: supportedTokens[2],
} as const;

export const apeChainCurtis = defineChain({
  id: 33111,
  chainId: 33111,
  chain: "ape-chain-curtis",
  slug: "ape-chain-curtis",
  networkId: 33111,
  name: "Ape Chain Curtis",
  nativeCurrency: supportedTokens[0],
  rpc: "https://curtis.rpc.caldera.xyz/http",
  rpcUrls: {
    default: {
      http: ["https://curtis.rpc.caldera.xyz/http"],
      webSocket: ["wss://curtis.rpc.caldera.xyz/ws"],
    },
  },
  blockExplorers: [
    {
      name: "Ape Chain Nitro Curtis Explorer",
      url: "https://curtis.explorer.caldera.xyz",
    },
  ],
});
