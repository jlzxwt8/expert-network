/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@ton/crypto",
      "@ton/ton",
      "@telegram-apps/init-data-node",
      "stripe",
    ],
  },
};

export default nextConfig;
