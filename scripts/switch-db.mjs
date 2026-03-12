#!/usr/bin/env node
/**
 * Switch between Supabase (PostgreSQL) and TiDB (MySQL) database providers.
 *
 * Usage:
 *   node scripts/switch-db.mjs          # reads DB_PROVIDER from .env
 *   node scripts/switch-db.mjs supabase # explicit override
 *   node scripts/switch-db.mjs tidb     # explicit override
 *
 * What it does:
 *   1. Patches prisma/schema.prisma  → provider = "postgresql" | "mysql"
 *   2. Patches prisma.config.ts      → adds/removes directUrl (Supabase needs it)
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Determine provider
let provider = process.argv[2];
if (!provider) {
  try {
    const envContent = readFileSync(resolve(root, ".env"), "utf-8");
    const match = envContent.match(/^DB_PROVIDER\s*=\s*"?(\w+)"?/m);
    provider = match ? match[1] : "supabase";
  } catch {
    provider = "supabase";
  }
}

if (!["supabase", "tidb"].includes(provider)) {
  console.error(`[switch-db] Unknown provider "${provider}". Use "supabase" or "tidb".`);
  process.exit(1);
}

const isPg = provider === "supabase";
console.log(`[switch-db] Switching to: ${provider} (${isPg ? "PostgreSQL" : "MySQL"})`);

// --- Patch schema.prisma (provider only; @db.Text works for both) ---
const schemaPath = resolve(root, "prisma/schema.prisma");
let schema = readFileSync(schemaPath, "utf-8");
schema = schema.replace(
  /provider\s*=\s*"(postgresql|mysql)"/,
  `provider = "${isPg ? "postgresql" : "mysql"}"`
);
writeFileSync(schemaPath, schema);
console.log(`[switch-db] schema.prisma → provider = "${isPg ? "postgresql" : "mysql"}"`);

// --- Patch prisma.config.ts (directUrl for Supabase pgbouncer) ---
const configPath = resolve(root, "prisma.config.ts");
let config = readFileSync(configPath, "utf-8");

if (isPg && !config.includes("directUrl")) {
  config = config.replace(
    /url:\s*process\.env\["DATABASE_URL"\],?/,
    'url: process.env["DATABASE_URL"],\n    directUrl: process.env["DIRECT_URL"],'
  );
  writeFileSync(configPath, config);
  console.log(`[switch-db] prisma.config.ts → added directUrl`);
} else if (!isPg && config.includes("directUrl")) {
  config = config.replace(/\s*directUrl:\s*process\.env\["DIRECT_URL"\],?\n?/, "\n");
  writeFileSync(configPath, config);
  console.log(`[switch-db] prisma.config.ts → removed directUrl`);
} else {
  console.log(`[switch-db] prisma.config.ts → no changes needed`);
}

console.log(`[switch-db] Done!`);
