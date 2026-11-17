#!/usr/bin/env node
/**
 * Defense full-viewport capture for coordinator artifacts (matches e2e/visual defense test).
 * Usage: npm run build:e2e && node scripts/capture-defense-viewport-split.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { chromium, devices } from "@playwright/test";

const repo = new URL("..", import.meta.url).pathname;

const STALE_MD5 = "28bd19dee61d3e989c5174667bb36951";
const CLIP = { x: 0, y: 0, width: 540, height: 1200 };
const defaultOut =
  process.env.DEFENSE_VIEWPORT_ARTIFACT ??
  "/opt/cursor/artifacts/defense-viewport-split-540x1200.png";

function md5File(path) {
  return createHash("md5").update(readFileSync(path)).digest("hex");
}

const port = process.env.E2E_PORT ?? "4173";
const baseURL = `http://127.0.0.1:${port}`;
const sha = execSync(`git -C ${repo} rev-parse --short HEAD`, {
  encoding: "utf8",
}).trim();

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
  await waitForHttp(`${baseURL}/`);
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
  await page.screenshot({ path: defaultOut, clip: CLIP });

  const md5 = md5File(defaultOut);
  console.log(
    JSON.stringify(
      {
        out: defaultOut,
        md5,
        staleMd5: STALE_MD5,
        md5Changed: md5 !== STALE_MD5,
        sha,
      },
      null,
      2,
    ),
  );

  if (md5 === STALE_MD5) {
    console.error("FAIL: artifact md5 still matches pre-panel-fix baseline");
    process.exitCode = 1;
  }

  await browser.close();
} finally {
  preview.kill();
}