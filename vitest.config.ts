import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/lib/nom035/__tests__/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/e2e/**", "**/e2e-staging/**", "**/.next/**"],
  },
});
