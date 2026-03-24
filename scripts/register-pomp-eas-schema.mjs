/**
 * One-time: register the POMP schema on Base (or Base Sepolia) and print POMP_EAS_SCHEMA_UID.
 *
 * Usage:
 *   BASE_RPC_URL=... POMP_ISSUER_PRIVATE_KEY=0x... CHAIN_ID=84532 node scripts/register-pomp-eas-schema.mjs
 *
 * EAS has no subscription fee; you only pay gas for this transaction + each attestation.
 *
 * Note: loads eas-sdk via CommonJS build (Next.js uses its own bundler for the app).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const easSdkMain = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../node_modules/@ethereum-attestation-service/eas-sdk/dist/lib.commonjs/index.js"
);
const { SchemaRegistry } = require(easSdkMain);
const { ethers } = require("ethers");

const POMP_EAS_SCHEMA =
  "bytes32 sessionHash,string expertId,string menteeId,string topic,string recipientRole";

const SCHEMA_REGISTRY = "0x4200000000000000000000000000000000000020";

async function main() {
  const rpc = process.env.BASE_RPC_URL;
  const pk = process.env.POMP_ISSUER_PRIVATE_KEY;
  const chainId = Number(process.env.CHAIN_ID || "84532");
  if (!rpc || !pk) {
    console.error("Set BASE_RPC_URL and POMP_ISSUER_PRIVATE_KEY");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(pk.trim().startsWith("0x") ? pk.trim() : `0x${pk.trim()}`, provider);
  const reg = new SchemaRegistry(SCHEMA_REGISTRY).connect(signer);

  const tx = await reg.register({
    schema: POMP_EAS_SCHEMA,
    resolverAddress: ethers.ZeroAddress,
    revocable: true,
  });

  const uid = await tx.wait();
  console.log("Registered schema UID (set as POMP_EAS_SCHEMA_UID):", uid);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
