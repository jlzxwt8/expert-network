import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const raw = process.env.DATABASE_URL!;
  const parsed = new URL(raw);

  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parseInt(parsed.port || "3306"),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, "") || undefined,
    ssl: parsed.searchParams.get("sslaccept") === "strict"
      ? { rejectUnauthorized: true }
      : parsed.hostname.includes("tidbcloud.com")
        ? { rejectUnauthorized: false }
        : undefined,
    connectTimeout: 10000,
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
