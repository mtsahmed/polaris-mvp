import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-user and behind login, so plain dynamic rendering is used.
  // Cache Components can be adopted later for public pages if any are added.
  cacheComponents: false,
  turbopack: {
    root: path.resolve(import.meta.dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
