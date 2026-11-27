#!/usr/bin/env node
/**
 * Fail if the production phaser manual chunk gzip regresses more than 5% over baseline.
 * Baseline: custom build replacing phaser-arcade-physics.js (~305 KiB gzip on main).
 * Update BASELINE_GZIP when intentionally growing the vendor bundle.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "../..");
const distAssets = path.join(repoRoot, "dist/assets");

/**
 * Gzip bytes of phaser chunk (main baseline was ~304 880 with phaser-arcade-physics.js).
 * Custom DefenseGame build target (Nov 2026): 267_940 → 248_233 after dropping Tilemaps + Tilemap loaders
 * (Vite 5); 248_997 → 230_349 re-measured under Vite 8. Then → 261_236 for Phaser 4.2.1 (Vite 8): the v4
 * render-node renderer + unified Filter system are larger (+13.4% vs the trimmed 3.90 build, +4.9% vs the
 * untrimmed 3.90 build).
 */
const BASELINE_GZIP = 261_236;
const MAX_REGRESSION_RATIO = 1.05;

function findPhaserChunk() {
  if (!fs.existsSync(distAssets)) {
    throw new Error("dist/assets missing — run vite build first");
  }
  const files = fs
    .readdirSync(distAssets)
    .filter((f) => /^phaser-[\w-]+\.js$/.test(f));
  if (files.length !== 1) {
    throw new Error(
      `Expected one phaser-*.js in dist/assets, found: ${files.join(", ") || "none"}`,
    );
  }
  return path.join(distAssets, files[0]);
}

const chunkPath = findPhaserChunk();
const raw = fs.readFileSync(chunkPath);
const gzip = zlib.gzipSync(raw).length;
const limit = Math.ceil(BASELINE_GZIP * MAX_REGRESSION_RATIO);

console.log(
  `phaser chunk ${path.basename(chunkPath)}: raw=${raw.length} gzip=${gzip} (baseline gzip=${BASELINE_GZIP}, limit=${limit})`,
);

if (gzip > limit) {
  console.error(
    `Phaser chunk gzip regressed more than 5% (got ${gzip}, limit ${limit}). Rebuild vendor bundle or raise BASELINE_GZIP in scripts/build/assert-phaser-chunk-size.mjs with justification.`,
  );
  process.exit(1);
}
