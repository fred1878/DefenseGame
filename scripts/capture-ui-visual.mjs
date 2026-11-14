#!/usr/bin/env node
/**
 * Project store HUD screenshots (live page.screenshot, not snapshot copies).
 * Usage: rm -rf dist && npm run build:e2e && node scripts/capture-ui-visual.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium, devices } from "@playwright/test";

const repo = new URL("..", import.meta.url).pathname;
const port = process.env.CAPTURE_PORT ?? "4199";
const sha =
  process.env.SHORT_SHA ??
  (await import("node:child_process")).execSync(`git -C ${repo} rev-parse --short HEAD`, {
    encoding: "utf8",
  }).trim();
const dir = "/cursor/stores/self/media/gothic-ui-visual-test";
const townOut = `${dir}/town-REAL-${sha}.png`;
const defenseOut = `${dir}/defense-hud-REAL-${sha}.png`;

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

function md5(path) {
  return createHash("md5").update(readFileSync(path)).digest("hex");
}

const preview = spawn(
  "npm",
  ["run", "preview", "--", "--port", String(port), "--host", "127.0.0.1"],
  { cwd: repo, env: { ...process.env, VITE_BASE: "/" }, stdio: "ignore" },
);

try {
  await waitForHttp(`http://127.0.0.1:${port}/`);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 540, height: 1200 },
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/?e2e=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () =>
      window.__DEFENSEGAME_E2E__?.scene === "Town" && window.__DEFENSEGAME_E2E__?.ready === true,
    null,
    { timeout: 45_000 },
  );
  await page.screenshot({
    path: townOut,
    clip: { x: 0, y: 0, width: 540, height: 1200 },
  });

  await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.startNight());
  await page.waitForFunction(
    () =>
      window.__DEFENSEGAME_E2E__?.scene === "Defense" &&
      window.__DEFENSEGAME_E2E__?.ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(120, 0));
  await wait(400);

  const metrics = await page.evaluate(() => {
    const targets = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
    return {
      hud: window.__HUD_DEBUG__ ?? {},
      spell0: targets["spell-slot-0"],
    };
  });

  await page.screenshot({
    path: defenseOut,
    clip: { x: 0, y: 0, width: 540, height: 1200 },
  });

  const report = {
    sha,
    town: { path: townOut, md5: md5(townOut) },
    defense: { path: defenseOut, md5: md5(defenseOut) },
    metrics,
  };
  writeFileSync(`${dir}/capture-${sha}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (metrics.spell0?.y != null && metrics.spell0.y <= 1000) {
    process.exitCode = 2;
  }

  await browser.close();
} finally {
  preview.kill();
}