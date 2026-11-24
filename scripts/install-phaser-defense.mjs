#!/usr/bin/env node
/**
 * Copies the committed custom Phaser UMD into node_modules so Vite resolves it like
 * the official phaser dist builds (vendor-only paths break CJS default interop).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(repoRoot, "vendor/phaser-defense.js");
const dest = path.join(repoRoot, "node_modules/phaser/dist/phaser-defensegame.js");

if (!fs.existsSync(src)) {
  console.error(`Missing ${src} — run npm run build:phaser and commit vendor/phaser-defense.js`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Installed ${path.relative(repoRoot, dest)}`);