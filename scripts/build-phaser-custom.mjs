#!/usr/bin/env node
/**
 * Build vendor/phaser-defense.js from the installed phaser package + trim manifests
 * under vendor/phaser-trim/. Re-run after bumping the phaser dependency.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import webpack from "webpack";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const phaserSrc = path.join(repoRoot, "node_modules/phaser/src");
const trimDir = path.join(repoRoot, "vendor/phaser-trim");
const entrySrc = path.join(trimDir, "phaser-defense-entry.js");
const entryTmp = path.join(phaserSrc, ".phaser-defense-entry.js");
const outFile = path.join(repoRoot, "vendor/phaser-defense.js");
const manifestFile = path.join(repoRoot, "vendor/phaser-defense.manifest.json");

/** @type {{ target: string; overlay: string }[]} */
const PHASER_OVERLAYS = [
  {
    target: path.join(phaserSrc, "gameobjects/index.js"),
    overlay: path.join(trimDir, "gameobjects-index.js"),
  },
  {
    target: path.join(phaserSrc, "loader/filetypes/index.js"),
    overlay: path.join(trimDir, "loader-filetypes-index.js"),
  },
];

function readPhaserVersion() {
  const pkg = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "node_modules/phaser/package.json"),
      "utf8",
    ),
  );
  return pkg.version;
}

async function runWebpack() {
  const configUrl = pathToFileURL(
    path.join(__dirname, "phaser-webpack.config.cjs"),
  ).href;
  const { default: config } = await import(configUrl);

  return new Promise((resolve, reject) => {
    webpack(config, (err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      if (stats.hasErrors()) {
        reject(new Error(stats.toString({ colors: false })));
        return;
      }
      resolve(stats);
    });
  });
}

function backupAndOverlay() {
  const restores = [];
  for (const { target, overlay } of PHASER_OVERLAYS) {
    if (!fs.existsSync(overlay)) {
      throw new Error(`Missing overlay: ${overlay}`);
    }
    const backup = `${target}.defensegame-bak`;
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(target, backup);
    }
    fs.copyFileSync(overlay, target);
    restores.push({ target, backup });
  }
  return () => {
    for (const { target, backup } of restores) {
      if (fs.existsSync(backup)) {
        fs.copyFileSync(backup, target);
        fs.unlinkSync(backup);
      }
    }
  };
}

async function main() {
  if (!fs.existsSync(entrySrc)) {
    throw new Error(`Missing entry: ${entrySrc}`);
  }

  const restorePhaser = backupAndOverlay();
  fs.copyFileSync(entrySrc, entryTmp);
  try {
    await runWebpack();
  } finally {
    fs.unlinkSync(entryTmp);
    restorePhaser();
  }

  const version = readPhaserVersion();
  const bytes = fs.statSync(outFile).size;
  const manifest = {
    phaserVersion: version,
    builtAt: new Date().toISOString(),
    bytes,
    entry: "vendor/phaser-trim/phaser-defense-entry.js",
    trims: [
      "physics: arcade-only (entry)",
      "tilemaps: removed from entry (no Phaser.Tilemaps namespace)",
      "gameobjects: trimmed index (see vendor/phaser-trim/gameobjects-index.js)",
      "loader: no Tilemap file types (see vendor/phaser-trim/loader-filetypes-index.js)",
      ...PHASER_OVERLAYS.map((o) => path.relative(repoRoot, o.overlay)),
    ],
  };
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `Wrote ${path.relative(repoRoot, outFile)} (${bytes} bytes, phaser@${version})`,
  );
  console.log(`Wrote ${path.relative(repoRoot, manifestFile)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
