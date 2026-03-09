import { createConnection } from "mariadb";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[setup-tidb] DATABASE_URL not set, skipping");
  process.exit(0);
}

if (!url.startsWith("mysql://")) {
  console.log("[setup-tidb] Not a MySQL URL, skipping");
  process.exit(0);
}

const parsed = new URL(url);
const dbName = parsed.pathname.replace(/^\//, "") || "test";

const baseUrl = `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.host}/`;

try {
  console.log(`[setup-tidb] Creating database "${dbName}" if not exists...`);
  const conn = await createConnection({
    host: parsed.hostname,
    port: parseInt(parsed.port || "4000"),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl: { rejectUnauthorized: false },
    connectTimeout: 20000,
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  console.log(`[setup-tidb] Database "${dbName}" ready`);
  await conn.end();
} catch (e) {
  console.error("[setup-tidb] Failed to create database:", e.message);
  console.log("[setup-tidb] Proceeding anyway (database may already exist)");
}
