#!/usr/bin/env node
/**
 * Fail if the generated service worker does not precache the Phaser chunk,
 * other JS chunks, or public game assets (data / png / mp3).
 * `version.json` is written after this script and must stay out of the precache.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const swPath = path.join(repoRoot, "dist/sw.js");

function extractPrecacheUrls(source) {
  const urls = [];
  const re = /(?:url|"url")\s*:\s*"([^"]+)"/g;
  let match = re.exec(source);
  while (match) {
    urls.push(match[1]);
    match = re.exec(source);
  }
  return urls;
}

function basename(urlPath) {
  const clean = urlPath.split("?")[0] ?? urlPath;
  const parts = clean.split("/");
  return parts[parts.length - 1] ?? clean;
}

if (!fs.existsSync(swPath)) {
  throw new Error(
    "dist/sw.js missing — vite-plugin-pwa should emit it during vite build",
  );
}

const source = fs.readFileSync(swPath, "utf8");
const urls = extractPrecacheUrls(source);

if (urls.length === 0) {
  throw new Error("No precache URLs found in dist/sw.js");
}

const names = urls.map(basename);
const hasIndex = names.includes("index.html");
const phaserChunks = names.filter((name) => /^phaser-[\w-]+\.js$/.test(name));
const otherJs = names.filter(
  (name) => name.endsWith(".js") && !/^phaser-[\w-]+\.js$/.test(name),
);
const dataJson = urls.filter((url) =>
  /(^|\/)data\/[^/?]+\.json(?:$|\?)/.test(url),
);
const pngs = names.filter((name) => name.endsWith(".png"));
const mp3s = names.filter((name) => name.endsWith(".mp3"));
const versionJson = urls.filter((url) => url.includes("version.json"));

const problems = [];
if (!hasIndex) problems.push("missing index.html");
if (phaserChunks.length !== 1) {
  problems.push(
    `expected one phaser-*.js chunk, found: ${phaserChunks.join(", ") || "none"}`,
  );
}
if (otherJs.length < 1) {
  problems.push("missing non-Phaser JS chunks (bootstrap / lazy scenes)");
}
if (dataJson.length < 1) problems.push("missing public/data/*.json");
if (pngs.length < 1) problems.push("missing PNG assets");
if (mp3s.length < 1) problems.push("missing MP3 assets");
if (versionJson.length > 0) {
  problems.push(
    `version.json must not be precached (${versionJson.join(", ")})`,
  );
}
if (!/skipWaiting/.test(source)) {
  problems.push(
    "sw.js does not call skipWaiting (new versions should activate)",
  );
}
if (/clientsClaim\s*\(/.test(source) || /clientsClaim:\s*!0/.test(source)) {
  problems.push(
    "sw.js claims clients immediately; new versions should wait for the next load",
  );
}

console.log(
  `PWA precache: ${urls.length} urls, phaser=${phaserChunks[0] ?? "none"}, otherJs=${otherJs.length}, dataJson=${dataJson.length}, png=${pngs.length}, mp3=${mp3s.length}`,
);

if (problems.length > 0) {
  console.error(`PWA precache assert failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
