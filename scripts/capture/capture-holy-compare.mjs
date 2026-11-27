#!/usr/bin/env node
/**
 * Player-centered holy heal FX compare captures (E2E hook).
 *
 * Usage:
 *   npm run build:e2e && node scripts/capture/capture-holy-compare.mjs --phase vectors-boost
 *   npm run build:e2e && node scripts/capture/capture-holy-compare.mjs --phase pack-wired
 *
 * Writes PNGs under DEFENSE_HOLY_COMPARE_OUT_DIR (default: store media/).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  gotoDefenseReady,
  gotoTownReady,
  withGamePreview,
} from "./lib/capture-preview.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const DATE_TAG = "2026-11-23";
const VERSION = "v1";
const CLIP_SIZE = 320;

const STALE_DENY = new Set([
  "28bd19dee61d3e989c5174667bb36951",
  "5946fdd5ea6b4b96841ad1df917e4e46",
]);

function md5(buf) {
  return createHash("md5").update(buf).digest("hex");
}

function parseArgs() {
  const phaseIdx = process.argv.indexOf("--phase");
  const phase = phaseIdx >= 0 ? process.argv[phaseIdx + 1] : "vectors-boost";
  if (phase !== "vectors-boost" && phase !== "pack-wired") {
    throw new Error(`Unknown --phase ${phase}`);
  }
  return { phase };
}

const defaultOutDir =
  process.env.DEFENSE_HOLY_COMPARE_OUT_DIR ?? "/cursor/stores/self/media";

function outPath(phase, kind) {
  mkdirSync(defaultOutDir, { recursive: true });
  return path.join(
    defaultOutDir,
    `holy-compare-${phase}-${kind}-${DATE_TAG}-${VERSION}.png`,
  );
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function playerCenteredClip(page) {
  return page.evaluate((size) => {
    const api = window.__DEFENSEGAME_E2E__?.api;
    if (!api) throw new Error("E2E api missing");
    const p = api.getPlayerPosition();
    const screen = api.worldPointToDefenseScreen(p.x, p.y);
    const half = size / 2;
    const x = Math.max(0, Math.round(screen.x - half));
    const y = Math.max(0, Math.round(screen.y - half));
    const w = Math.min(size, 540 - x);
    const h = Math.min(size, 1200 - y);
    return { x, y, width: w, height: h };
  }, CLIP_SIZE);
}

async function captureKind(page, phase, kind, waitMs) {
  await page.evaluate((k) => {
    window.__DEFENSEGAME_E2E__?.api?.previewHolyFx(k);
  }, kind);
  await wait(waitMs);
  const clip = await playerCenteredClip(page);
  const filePath = outPath(phase, kind);
  const png = await page.screenshot({ clip, type: "png" });
  writeFileSync(filePath, png);
  const hash = md5(png);
  if (STALE_DENY.has(hash)) {
    console.error(`FAIL: ${filePath} md5 ${hash} is denylisted`);
    process.exitCode = 1;
  }
  return { filePath, md5: hash };
}

const { phase } = parseArgs();

await withGamePreview(repoRoot, async ({ page, base }) => {
  await gotoTownReady(page, base);
  await gotoDefenseReady(page);
  await page.evaluate(() => {
    const api = window.__DEFENSEGAME_E2E__?.api;
    api?.killAllEnemies();
    api?.setGodMode(true);
    api?.setShowHitboxes(false);
    api?.setShowTouchInput(false);
    api?.centerDefenseCameraOn(0, 0);
    api?.setPlayerPosition(0, 0);
  });
  await wait(200);

  const flash = await captureKind(page, phase, "flash", 220);
  const channel = await captureKind(page, phase, "channel", 420);

  const results = [flash, channel];
  for (const r of results) {
    console.log(JSON.stringify(r));
  }

  const uniq = new Set(results.map((r) => r.md5));
  if (uniq.size !== results.length) {
    console.error("FAIL: flash and channel captures share the same md5");
    process.exitCode = 1;
  }

  const paths = results.map((r) => r.filePath);
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      if (
        existsSync(paths[i]) &&
        existsSync(paths[j]) &&
        readFileSync(paths[i]).equals(readFileSync(paths[j]))
      ) {
        console.error(`FAIL: identical bytes ${paths[i]} ${paths[j]}`);
        process.exitCode = 1;
      }
    }
  }
});

process.exit(process.exitCode ?? 0);
