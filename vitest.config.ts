import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for pure logic (journey status, fit score, source checks). No database or network.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
