#!/usr/bin/env node
/**
 * One-off defense HUD capture for Project store (not e2e snapshots).
 * Usage: npm run build:e2e && node scripts/capture-defense-hud.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium, devices } from "@playwright/test";

const OLD_MD5 = "5946fdd5ea6b4b96841ad1df917e4e46";
const repo = new URL("..", import.meta.url).pathname;
const port = process.env.CAPTURE_PORT ?? "4199";
const sha =
  process.env.SHORT_SHA ??
  (await import("node:child_process")).execSync("git -C " + repo + " rev-parse --short HEAD", {
    encoding: "utf8",
  }).trim();
const out = `/cursor/stores/self/media/gothic-ui-visual-test/defense-hud-REAL-${sha}.png`;

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
    const spell = targets["spell-slot-0"];
    const hud = window.__HUD_DEBUG__ ?? {};
    const canvas = document.querySelector("#game canvas");
    let spellPageTop = null;
    if (spell && canvas) {
      const rect = canvas.getBoundingClientRect();
      const sy = rect.height / 1200;
      spellPageTop = rect.top + spell.y * sy;
    }
  return {
      hud,
      spellCanvas: spell,
      spellPageTop,
      viewportH: window.innerHeight,
    };
  });

  await page.screenshot({
    path: out,
    clip: { x: 0, y: 0, width: 540, height: 1200 },
  });

  const buf = readFileSync(out);
  const md5 = createHash("md5").update(buf).digest("hex");

  console.log(
    JSON.stringify(
      {
        out,
        sha,
        md5,
        oldMd5: OLD_MD5,
        md5Changed: md5 !== OLD_MD5,
        metrics,
      },
      null,
      2,
    ),
  );

  if (metrics.spellPageTop != null && metrics.spellPageTop <= 1000) {
    process.exitCode = 2;
    console.error("FAIL: spell-slot-0 page top <= 1000");
  }
  if (md5 === OLD_MD5) {
    process.exitCode = 1;
    console.error("FAIL: screenshot md5 unchanged from stale baseline");
  }

  await browser.close();
} finally {
  preview.kill();
}