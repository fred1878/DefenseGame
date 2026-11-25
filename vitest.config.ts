import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      phaser: path.resolve(import.meta.dirname, "src/test/phaserStub.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["src/test/bootPublicConfig.ts"],
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/vite-env.d.ts",
        "src/main.ts",
        "src/scenes/**",
        "src/world/**",
      ],
      // Re-baselined for Vitest 5: its v8 provider maps coverage through the
      // AST (Vitest 2 counted per source line), so the same tests report lower
      // numbers. Keep these just under the actual totals.
      thresholds: {
        lines: 59,
        functions: 58,
        branches: 54,
        statements: 58,
      },
    },
  },
});