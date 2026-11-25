import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { phaserModulePreloadPlugin } from "./vite-plugin-phaser-preload";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [phaserModulePreloadPlugin()],
  /** Dev: `/`. Production: GitHub Pages project path (override with VITE_BASE). */
  base:
    process.env.VITE_BASE ?? (mode === "production" ? "/DefenseGame/" : "/"),
  resolve: {
    alias: {
      phaser: path.join(
        repoRoot,
        "node_modules/phaser/dist/phaser-defensegame.js",
      ),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: mode !== "production",
    commonjsOptions: {
      defaultIsModuleExports: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/phaser") ||
            id.includes("phaser-defensegame.js")
          ) {
            return "phaser";
          }
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
}));
