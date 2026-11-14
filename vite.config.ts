import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  /** Dev: `/`. Production: GitHub Pages project path (override with VITE_BASE). */
  base: process.env.VITE_BASE ?? (mode === "production" ? "/DefenseGame/" : "/"),
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
}));