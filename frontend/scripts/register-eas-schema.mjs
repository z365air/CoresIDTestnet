// Registers the BaseBoundID link schema with the EAS SchemaRegistry on
// Base Sepolia, then prints the resulting schema UID.
//
// Usage (PowerShell):
//   $env:PRIVATE_KEY="0x..."; node scripts/register-eas-schema.mjs
//
// The schema UID it prints goes into .env.local as NEXT_PUBLIC_EAS_SCHEMA_UID.
//
// Note: a schema is registered ONCE per unique (schema string, resolver,
// revocable) tuple. If it already exists, EAS returns the existing UID and
// the tx may revert with "AlreadyExists" - in that case compute the UID
// off-chain (see printUid below) instead of re-registering.

import {
  createWalletClient,
  createPublicClient,
  http,
  encodePacked,
  keccak256,
  decodeEventLog,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const SCHEMA_REGISTRY = "0x4200000000000000000000000000000000000020";
const SCHEMA = "address source,address target,uint256 tokenId,string role";
const RESOLVER = "0x0000000000000000000000000000000000000000";
const REVOCABLE = true;

const REGISTRY_ABI = [
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
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "uid", type: "bytes32", indexed: true },
      { name: "registerer", type: "address", indexed: true },
    ],
  },
];

// EAS computes the schema UID as keccak256(abi.encodePacked(schema, resolver, revocable)).
function computeSchemaUid() {
  return keccak256(
    encodePacked(
      ["string", "address", "bool"],
      [SCHEMA, RESOLVER, REVOCABLE],
    ),
  );
}

async function main() {
  const pk = process.env.PRIVATE_KEY;
  const predictedUid = computeSchemaUid();
  console.log(`Schema string : ${SCHEMA}`);
  console.log(`Resolver       : ${RESOLVER}`);
  console.log(`Revocable      : ${REVOCABLE}`);
  console.log(`Predicted UID  : ${predictedUid}`);

  if (!pk) {
    console.log(
      "\nNo PRIVATE_KEY set. The predicted UID above is what EAS will use.\n" +
        "If the schema is already registered, just use that UID.\n" +
        "To register it on-chain, set PRIVATE_KEY and re-run.",
    );
    return;
  }

  const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const transport = http(
    process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  );
  const wallet = createWalletClient({ account, chain: baseSepolia, transport });
  const publicClient = createPublicClient({ chain: baseSepolia, transport });

  console.log(`\nRegistering from ${account.address}...`);

  try {
    const hash = await wallet.writeContract({
      address: SCHEMA_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "register",
      args: [SCHEMA, RESOLVER, REVOCABLE],
    });
    console.log(`Tx: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    let uid = predictedUid;
    for (const log of receipt.logs) {
      try {
        const parsed = decodeEventLog({
          abi: REGISTRY_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (parsed.eventName === "Registered") {
          uid = parsed.args.uid;
          break;
        }
      } catch {
        // not our event
      }
    }

    console.log(`\nSUCCESS. Schema UID: ${uid}`);
    console.log(`Add to .env.local:\nNEXT_PUBLIC_EAS_SCHEMA_UID=${uid}`);
  } catch (error) {
    console.error(
      `\nRegistration failed (it may already exist).\n` +
        `If it already exists, use the predicted UID: ${predictedUid}\n`,
    );
    console.error(error.shortMessage || error.message || error);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
