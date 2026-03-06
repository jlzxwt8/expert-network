import pg from "pg";
import { config } from "dotenv";
config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env");
  process.exit(1);
}

const url = new URL(DATABASE_URL);
const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
const ssl = isLocal ? false : { rejectUnauthorized: false };

console.log(`Connecting to: ${url.hostname}:${url.port || 5432}/${url.pathname.slice(1)}`);
console.log(`SSL: ${ssl ? "enabled" : "disabled"}\n`);

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl,
  connectionTimeoutMillis: 15000,
});

try {
  const t0 = Date.now();
  await client.connect();
  const res = await client.query(
    "SELECT NOW() as server_time, current_database() as db, current_user as user, version() as version"
  );
  const elapsed = Date.now() - t0;
  const { server_time, db, user, version } = res.rows[0];
  console.log(`SUCCESS (${elapsed}ms)`);
  console.log(`  Server time: ${server_time}`);
  console.log(`  Database:    ${db}`);
  console.log(`  User:        ${user}`);
  console.log(`  Version:     ${version.split(",")[0]}`);
  await client.end();
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  try { await client.end(); } catch {}
  process.exit(1);
}
