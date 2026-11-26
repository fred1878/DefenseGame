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
        "src/appUpdate/apkInstallerPlugin.ts",
        "src/appUpdate/runCheckForUpdate.ts",
      ],
      // Actual coverage is higher (lines/statements/functions ~98%,
      // branches ~96%). These floors leave a little room without going back
      // to the old 75/69 baselines.
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
});
