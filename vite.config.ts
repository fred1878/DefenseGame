import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import {
  PWA_BACKGROUND_COLOR,
  PWA_PRECACHE_GLOB_IGNORES,
  PWA_PRECACHE_GLOB_PATTERNS,
  PWA_THEME_COLOR,
} from "./src/pwa/precachePolicy.ts";
import { phaserModulePreloadPlugin } from "./vite-plugin-phaser-preload.ts";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const packageVersion = (
  JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    version: string;
  }
).version;

export default defineConfig(({ mode }) => {
  const android = mode === "android";
  if (!process.env.VITE_APP_VERSION) {
    process.env.VITE_APP_VERSION = packageVersion;
  }

  return {
    plugins: [
      phaserModulePreloadPlugin(),
      VitePWA({
        // Always generate the SW in production builds (including e2e).
        // Registration itself is skipped in dev and e2e — see registerServiceWorker.
        registerType: "prompt",
        injectRegister: false,
        filename: "sw.js",
        manifestFilename: "manifest.webmanifest",
        includeAssets: [
          "icons/icon-192.png",
          "icons/icon-512.png",
          "icons/icon-192-maskable.png",
          "icons/icon-512-maskable.png",
          "icons/apple-touch-icon.png",
        ],
        manifest: {
          name: "DefenseGame",
          short_name: "DefenseGame",
          description:
            "Upgrade your town by day, defend the north wall by night.",
          display: "standalone",
          orientation: "portrait",
          theme_color: PWA_THEME_COLOR,
          background_color: PWA_BACKGROUND_COLOR,
          start_url: "./",
          scope: "./",
          lang: "en",
          categories: ["games"],
          icons: [
            {
              src: "icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icons/icon-192-maskable.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "icons/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // Activate the new worker as soon as it installs, but do not seize
          // open clients. The next page load gets the new version.
          skipWaiting: true,
          clientsClaim: false,
          cleanupOutdatedCaches: true,
          globPatterns: [...PWA_PRECACHE_GLOB_PATTERNS],
          globIgnores: [...PWA_PRECACHE_GLOB_IGNORES],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.endsWith("/version.json"),
              handler: "NetworkOnly",
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    /**
     * Dev: `/`. Production: GitHub Pages project path.
     * Android / Capacitor: relative `./` so the WebView can load bundled assets.
     * Override with VITE_BASE (used by e2e).
     */
    base:
      process.env.VITE_BASE ??
      (android ? "./" : mode === "production" ? "/DefenseGame/" : "/"),
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
      sourcemap: mode !== "production" && !android,
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
  };
});
