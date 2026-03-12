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
 *   Patches prisma/schema.prisma provider between "postgresql" and "mysql".
 *   The runtime adapter in src/lib/prisma.ts auto-detects based on DATABASE_URL.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

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

const schemaPath = resolve(root, "prisma/schema.prisma");
let schema = readFileSync(schemaPath, "utf-8");
schema = schema.replace(
  /provider\s*=\s*"(postgresql|mysql)"/,
  `provider = "${isPg ? "postgresql" : "mysql"}"`
);
writeFileSync(schemaPath, schema);
console.log(`[switch-db] schema.prisma -> provider = "${isPg ? "postgresql" : "mysql"}"`);
console.log(`[switch-db] Done!`);
