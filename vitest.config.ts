import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Mirror the tsconfig "@/*" -> project root alias so tests import the same way the app does.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // The rating/stats engine is pure TypeScript with no DOM or I/O.
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
