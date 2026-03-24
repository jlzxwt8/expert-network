import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid picking a parent-folder lockfile as the tracing root (e.g. ~/package-lock.json).
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: [
    "@ton/crypto",
    "@ton/ton",
    "@telegram-apps/init-data-node",
  ],
};

export default nextConfig;
