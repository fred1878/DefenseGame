import { spawn, execSync } from "node:child_process";
import { chromium, devices } from "@playwright/test";

const VIEWPORT = { width: 540, height: 1200 };
const CLIP = { x: 0, y: 0, width: 540, height: 1200 };

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

export async function withGamePreview(repoRoot, fn) {
  const port = process.env.CAPTURE_PORT ?? "4199";
  const base = `http://127.0.0.1:${port}`;
  const preview = spawn(
    "npm",
    ["run", "preview", "--", "--port", String(port), "--host", "127.0.0.1"],
    { cwd: repoRoot, env: { ...process.env, VITE_BASE: "/" }, stdio: "ignore" },
  );

  try {
    await waitForHttp(`${base}/`);
    const browser = await chromium.launch();
    const context = await browser.newContext({
      ...devices["Pixel 7"],
      viewport: VIEWPORT,
    });
    const page = await context.newPage();
    await fn({ page, base, browser });
    await browser.close();
  } finally {
    preview.kill();
  }
}

export async function gotoTownReady(page, base) {
  await page.goto(`${base}/?e2e=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () =>
      window.__DEFENSEGAME_E2E__?.scene === "Town" &&
      window.__DEFENSEGAME_E2E__?.ready === true,
    null,
    { timeout: 45_000 },
  );
}

export async function gotoDefenseReady(page) {
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
}

export async function screenshotViewport(page, outPath) {
  await page.screenshot({ path: outPath, clip: CLIP });
}

export function gitShortSha(repoRoot) {
  if (process.env.SHORT_SHA) return process.env.SHORT_SHA.trim();
  return execSync(`git -C ${repoRoot} rev-parse --short HEAD`, {
    encoding: "utf8",
  }).trim();
}