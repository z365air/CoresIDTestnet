import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // This app lives inside the Hardhat project folder, which has its own
  // lockfile. Pin the Turbopack root to this app so Next.js does not
  // mistakenly infer the parent directory as the workspace root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
