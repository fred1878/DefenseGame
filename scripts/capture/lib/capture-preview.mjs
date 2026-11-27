import { spawn, execSync } from "node:child_process";
import { chromium, devices } from "@playwright/test";

export const VIEWPORT = { width: 540, height: 1200 };
const CLIP = { x: 0, y: 0, width: 540, height: 1200 };

export function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitForHttp(url, maxMs = 60_000) {
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

export async function gotoDefenseReady(page, { spawnWarmupEnemy = true } = {}) {
  await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.startNight());
  await page.waitForFunction(
    () =>
      window.__DEFENSEGAME_E2E__?.scene === "Defense" &&
      window.__DEFENSEGAME_E2E__?.ready === true,
    null,
    { timeout: 30_000 },
  );
  if (spawnWarmupEnemy) {
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(120, 0),
    );
    await wait(400);
  }
}

/** Boot through Town into Defense without spawning a warmup enemy (capture scripts). */
export async function bootDefenseForCapture(page, base) {
  await gotoTownReady(page, base);
  await gotoDefenseReady(page, { spawnWarmupEnemy: false });
  await page.evaluate(() => {
    const api = window.__DEFENSEGAME_E2E__?.api;
    api?.setGodMode(true);
    api?.setSpawnPlanComplete();
    api?.setManualReturnToTown(true);
    api?.setShowHitboxes(false);
    api?.setShowTouchInput(false);
    api?.centerDefenseCameraOn(0, 80);
    api?.setPlayerPosition(0, 80);
  });
  await wait(250);
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
