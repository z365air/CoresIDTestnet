import type { Address } from "viem";

export const CORESID_CHAIN_ID = 84532;
export const CORESID_CHAIN = {
  id: CORESID_CHAIN_ID,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://sepolia.base.org"],
  blockExplorerUrls: ["https://sepolia.basescan.org"],
};

export const CORESID_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CORESID_CONTRACT_ADDRESS as Address | undefined) ??
  "0xbF81a03b8eecf0Bf8eFEe1D5622e25876D0b82cd";

export const CORESID_EXPLORER_URL = `https://sepolia.basescan.org/address/${CORESID_CONTRACT_ADDRESS}`;
export const CORESID_TX_URL = (hash: string) => `https://sepolia.basescan.org/tx/${hash}`;

export const CORESID_ABI = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "nominate",
    inputs: [{ name: "seeds", type: "address[]" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "cancelNomination",
    inputs: [{ name: "seed", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mint",
    inputs: [{ name: "core", type: "address" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "isNominated",
    inputs: [
      { name: "core", type: "address" },
      { name: "seed", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "coreOfSeed",
    inputs: [{ name: "seed", type: "address" }],
    outputs: [{ name: "core", type: "address" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "seedCount",
    inputs: [{ name: "core", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getPendingSeeds",
    inputs: [{ name: "core", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getLinkedSeeds",
    inputs: [{ name: "core", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "revoke",
    inputs: [{ name: "seed", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "coreTokenId",
    inputs: [{ name: "core", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "MAX_SEEDS",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Nominated",
    inputs: [
      { name: "core", type: "address", indexed: true },
      { name: "seed", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "NominationCancelled",
    inputs: [
      { name: "core", type: "address", indexed: true },
      { name: "seed", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Minted",
    inputs: [
      { name: "core", type: "address", indexed: true },
      { name: "seed", type: "address", indexed: true },
      { name: "level", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Revoked",
    inputs: [
      { name: "core", type: "address", indexed: true },
      { name: "seed", type: "address", indexed: true },
      { name: "level", type: "uint256", indexed: true },
    ],
  },
] as const;

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
