import type { Address } from "viem";

export const CORESID_CHAIN_ID = 84532;

export const CORESID_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CORESID_CONTRACT_ADDRESS as Address | undefined) ??
  "0x0000000000000000000000000000000000000000";

export const CORESID_EXPLORER_URL = `https://sepolia.basescan.org/address/${CORESID_CONTRACT_ADDRESS}`;

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
    name: "pendingCount",
    inputs: [{ name: "core", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
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
    type: "function",
    stateMutability: "view",
    name: "totalSupply",
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
] as const;

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
