import type { NextConfig } from "next";

const backend = process.env.SERVER_URL ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  // Engine.IO requires its trailing slash; Next must not redirect the handshake.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/api/session/:path*", destination: `${backend}/api/session/:path*` },
      { source: "/api/cases", destination: `${backend}/api/cases` },
      { source: "/socket.io/", destination: `${backend}/socket.io/` },
    ];
  },
};

export default nextConfig;
