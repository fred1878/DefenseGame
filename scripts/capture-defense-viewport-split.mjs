#!/usr/bin/env node
/**
 * Manual defense viewport review shot (not committed visual baselines).
 * Usage: npm run build:e2e && node scripts/capture-defense-viewport-split.mjs
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { dirname } from "node:path";
import { chromium, devices } from "@playwright/test";

const repo = new URL("..", import.meta.url).pathname;

const CLIP = { x: 0, y: 0, width: 540, height: 1200 };
const HUD_BAND_MIN_LUMINANCE_LIFT = 22;
const HUD_BAND_MIN_LUMINANCE = 58;

/** Stale / already-reported review shots — must not re-ship. */
const MD5_DENYLIST = new Set([
  "28bd19dee61d3e989c5174667bb36951",
  "da201664d9fa10cbf31db112ea7ba6b5",
  "62d865711caf97a6c2ff41c4f6589cae",
  "a2b9f3ecf744ec39181a84c98bbbb773",
]);

function md5File(path) {
  return createHash("md5").update(readFileSync(path)).digest("hex");
}

function isoSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function hudBandPixelProbesPass(samples) {
  if (!samples?.playArea || !samples?.topBand || !samples?.bottomBand)
    return false;
  const play = samples.playArea.luminance;
  return (
    samples.topBand.luminance > play + HUD_BAND_MIN_LUMINANCE_LIFT &&
    samples.bottomBand.luminance > play + HUD_BAND_MIN_LUMINANCE_LIFT &&
    samples.topBand.luminance >= HUD_BAND_MIN_LUMINANCE &&
    samples.bottomBand.luminance >= HUD_BAND_MIN_LUMINANCE &&
    samples.topBand.r > 52 &&
    samples.bottomBand.r > 52
  );
}

const port = process.env.E2E_PORT ?? "4173";
const baseURL = `http://127.0.0.1:${port}`;
const sha = execSync(`git -C ${repo} rev-parse --short HEAD`, {
  encoding: "utf8",
}).trim();
const out =
  process.env.DEFENSE_VIEWPORT_ARTIFACT ??
  `/opt/cursor/artifacts/review/defense-viewport-${sha}-${isoSlug()}.png`;

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

async function waitForHudBandProbes(page, maxMs = 15_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const samples = await page.evaluate(async () =>
      window.__DEFENSEGAME_E2E__?.api?.sampleDefenseHudBandPixelsAsync(),
    );
    if (samples && hudBandPixelProbesPass(samples)) return samples;
    await wait(150);
  }
  return page.evaluate(async () =>
    window.__DEFENSEGAME_E2E__?.api?.sampleDefenseHudBandPixelsAsync(),
  );
}

const preview = spawn(
  "npm",
  ["run", "preview", "--", "--port", String(port), "--host", "127.0.0.1"],
  { cwd: repo, env: { ...process.env, VITE_BASE: "/" }, stdio: "ignore" },
);

try {
  await waitForHttp(`${baseURL}/`);
  mkdirSync(dirname(out), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: CLIP,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.removeItem("defensegame-e2e-save");
  });
  await page.goto(`${baseURL}/?e2e=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () =>
      window.__DEFENSEGAME_E2E__?.scene === "Town" &&
      window.__DEFENSEGAME_E2E__?.ready === true,
    { timeout: 45_000 },
  );
  await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.startNight());
  await page.waitForFunction(
    () =>
      window.__DEFENSEGAME_E2E__?.scene === "Defense" &&
      window.__DEFENSEGAME_E2E__?.ready === true,
    { timeout: 30_000 },
  );
  await page.evaluate(async () => {
    await window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(120, 0);
  });
  await page.evaluate(() => {
    const root = document.getElementById("defensegame-e2e-dom");
    if (root) root.style.visibility = "hidden";
  });

  const samples = await waitForHudBandProbes(page);
  if (!hudBandPixelProbesPass(samples)) {
    console.error("FAIL: HUD band pixel probes did not pass", samples);
    process.exitCode = 1;
  }

  await page.screenshot({ path: out, clip: CLIP });

  const md5 = md5File(out);
  console.log(
    JSON.stringify(
      {
        out,
        md5,
        sha,
        pixelProbesPass: hudBandPixelProbesPass(samples),
        pixelSamples: samples,
        denylisted: MD5_DENYLIST.has(md5),
      },
      null,
      2,
    ),
  );

  if (MD5_DENYLIST.has(md5)) {
    console.error("FAIL: artifact md5 is on the stale denylist");
    process.exitCode = 1;
  }
  if (!hudBandPixelProbesPass(samples)) {
    process.exitCode = 1;
  }

  await browser.close();
} finally {
  preview.kill();
}
