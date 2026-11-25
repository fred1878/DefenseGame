#!/usr/bin/env node
/**
 * Record player-centered holy heal blend (pack sprites + vector rings) via E2E.
 *
 *   npm run build:e2e && node scripts/capture-holy-blend-video.mjs
 *
 * Writes trimmed webms under DEFENSE_HOLY_COMPARE_OUT_DIR (default store media/).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { chromium, devices } from "@playwright/test";
import {
  gotoDefenseReady,
  gotoTownReady,
} from "./lib/capture-preview.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const DATE_TAG = "2026-11-23";
const VERSION = "v2";
const VIEWPORT = { width: 540, height: 1200 };

const TRIM_FLASH_S = 1.04;
const TRIM_CHANNEL_S = 2.52;

const V1_MD5 = new Set([
  "c4db8b5197c9c0d500ba25b152b0d00d",
  "fca236c4700cb10cc36b8c474eb93898",
  "90caffc932a1aa58f8548c9ab92835c6",
  "1858aea636564191e141a4653ea2d17e",
]);

function md5(buf) {
  return createHash("md5").update(buf).digest("hex");
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHttp(url, maxMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await wait(300);
  }
  throw new Error(`Server not ready: ${url}`);
}

const defaultOutDir =
  process.env.DEFENSE_HOLY_COMPARE_OUT_DIR ??
  "/cursor/stores/self/media";

function outWebm(kind) {
  mkdirSync(defaultOutDir, { recursive: true });
  return path.join(
    defaultOutDir,
    `holy-heal-blend-${kind}-${DATE_TAG}-${VERSION}.webm`,
  );
}

function trimTail(inputWebm, outputWebm, tailSeconds) {
  const probe = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputWebm}"`,
    { encoding: "utf8" },
  ).trim();
  const dur = parseFloat(probe);
  if (!Number.isFinite(dur) || dur <= tailSeconds) {
    throw new Error(`Video too short: ${inputWebm} dur=${probe}`);
  }
  const start = dur - tailSeconds;
  execSync(
    `ffmpeg -y -ss ${start.toFixed(3)} -i "${inputWebm}" -t ${tailSeconds} -c:v libvpx-vp9 -crf 32 -b:v 0 "${outputWebm}"`,
    { stdio: "ignore" },
  );
}

async function recordKind(page, base, kind, recordMs) {
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
  await page.evaluate((k) => {
    window.__DEFENSEGAME_E2E__?.api?.previewHolyFx(k);
  }, kind);
  await wait(recordMs);
}

const port = process.env.CAPTURE_PORT ?? "4199";
const base = `http://127.0.0.1:${port}`;
const preview = await import("node:child_process").then(({ spawn }) =>
  spawn(
    "npm",
    ["run", "preview", "--", "--port", String(port), "--host", "127.0.0.1"],
    { cwd: repoRoot, env: { ...process.env, VITE_BASE: "/" }, stdio: "ignore" },
  ),
);

try {
  await waitForHttp(`${base}/`);
  const browser = await chromium.launch();

  for (const { kind, recordMs, trimS } of [
    { kind: "flash", recordMs: 1200, trimS: TRIM_FLASH_S },
    { kind: "channel", recordMs: 3200, trimS: TRIM_CHANNEL_S },
  ]) {
    const videoDir = path.join(repoRoot, ".capture-videos");
    mkdirSync(videoDir, { recursive: true });
    const context = await browser.newContext({
      ...devices["Pixel 7"],
      viewport: VIEWPORT,
      recordVideo: { dir: videoDir, size: VIEWPORT },
    });
    const page = await context.newPage();
    await page.goto(`${base}/?e2e=1`, { waitUntil: "networkidle" });
    await recordKind(page, base, kind, recordMs);
    await context.close();
    const videos = readdirSync(videoDir).filter((f) => f.endsWith(".webm"));
    const raw = path.join(videoDir, videos[videos.length - 1]);
    const out = outWebm(kind);
    trimTail(raw, out, trimS);
    unlinkSync(raw);
    const buf = readFileSync(out);
    const hash = md5(buf);
    if (V1_MD5.has(hash)) {
      throw new Error(`${out} md5 matches v1 compare denylist: ${hash}`);
    }
  }

  await browser.close();
} finally {
  preview.kill();
}

for (const kind of ["flash", "channel"]) {
  const out = outWebm(kind);
  const buf = readFileSync(out);
  console.log(
    JSON.stringify({
      filePath: out,
      bytes: buf.length,
      md5: md5(buf),
    }),
  );
}