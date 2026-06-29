import type { Address, Hex } from "viem";

export const BASEBOUND_CHAIN_ID = 84532; // Base Sepolia

// BaseBoundID (BBID) soulbound contract on Base Sepolia.
export const BASEBOUND_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_BASEBOUND_CONTRACT_ADDRESS as Address | undefined) ??
  "0xc8a2abcf6515f698dc02d21c81a7006899d66fb0";

export const BASEBOUND_EXPLORER_URL = `https://sepolia.basescan.org/address/${BASEBOUND_CONTRACT_ADDRESS}`;

// Proposal lifecycle, mirrors the on-chain enum.
export const ProposalStatus = {
  None: 0,
  Pending: 1,
  Claimed: 2,
} as const;

export type ProposalStatusValue =
  (typeof ProposalStatus)[keyof typeof ProposalStatus];

export const BASEBOUND_ABI = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "propose",
    inputs: [{ name: "target", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "cancelProposal",
    inputs: [{ name: "target", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "claim",
    inputs: [{ name: "source", type: "address" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "proposalStatus",
    inputs: [
      { name: "source", type: "address" },
      { name: "target", type: "address" },
    ],
    outputs: [{ name: "status", type: "uint8" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "activeCount",
    inputs: [{ name: "source", type: "address" }],
    outputs: [{ name: "count", type: "uint256" }],
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
    name: "sourceOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "source", type: "address" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "MAX_PER_SOURCE",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Proposed",
    inputs: [
      { name: "source", type: "address", indexed: true },
      { name: "target", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ProposalCancelled",
    inputs: [
      { name: "source", type: "address", indexed: true },
      { name: "target", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "source", type: "address", indexed: true },
      { name: "target", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// EAS (Ethereum Attestation Service) - OP-stack predeploys, same on all
// OP-stack chains including Base and Base Sepolia.
// ---------------------------------------------------------------------------
export const EAS_CONTRACT_ADDRESS: Address =
  "0x4200000000000000000000000000000000000021";
export const EAS_SCHEMA_REGISTRY_ADDRESS: Address =
  "0x4200000000000000000000000000000000000020";

// Registered once via scripts/register-eas-schema. Schema string:
//   "address source,address target,uint256 tokenId,string role"
export const EAS_SCHEMA_UID =
  (process.env.NEXT_PUBLIC_EAS_SCHEMA_UID as Hex | undefined) ??
  ("0x0000000000000000000000000000000000000000000000000000000000000000" as Hex);

export const EAS_SCHEMA_STRING =
  "address source,address target,uint256 tokenId,string role";

export const EAS_ABI = [
  {
    type: "function",
    stateMutability: "payable",
    name: "attest",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "schema", type: "bytes32" },
          {
            name: "data",
            type: "tuple",
            components: [
              { name: "recipient", type: "address" },
              { name: "expirationTime", type: "uint64" },
              { name: "revocable", type: "bool" },
              { name: "refUID", type: "bytes32" },
              { name: "data", type: "bytes" },
              { name: "value", type: "uint256" },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

export const EAS_SCHEMA_REGISTRY_ABI = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "register",
    inputs: [
      { name: "schema", type: "string" },
      { name: "resolver", type: "address" },
      { name: "revocable", type: "bool" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function isSchemaConfigured() {
  return (
    EAS_SCHEMA_UID !==
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  );
}
