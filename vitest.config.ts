import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      phaser: path.resolve(__dirname, "src/test/phaserStub.ts"),
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
      thresholds: {
        lines: 62,
        functions: 75,
        branches: 77,
        statements: 62,
      },
    },
  },
});