import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  /** Dev: `/`. Production: GitHub Pages project path (override with VITE_BASE). */
  base: process.env.VITE_BASE ?? (mode === "production" ? "/DefenseGame/" : "/"),
  build: {
    outDir: "dist",
    sourcemap: mode !== "production",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser")) {
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