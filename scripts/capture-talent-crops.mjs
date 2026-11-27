#!/usr/bin/env node
/**
 * Talent tree full frame + cropped branch headers and rank pill for PR review.
 * Usage: npm run build:e2e && node scripts/capture-talent-crops.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  gotoTownReady,
  screenshotViewport,
  wait,
  withGamePreview,
} from "./lib/capture-preview.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const outDir = "/opt/cursor/artifacts";
fs.mkdirSync(outDir, { recursive: true });

async function tapById(page, id) {
  const pt = await page.evaluate((targetId) => {
    const t = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets()?.[targetId];
    if (!t) return null;
    return { x: t.x, y: t.y };
  }, id);
  if (!pt) throw new Error(`tap target missing: ${id}`);
  const box = await page.locator("#game canvas").boundingBox();
  if (!box) throw new Error("canvas missing");
  await page.mouse.click(
    box.x + (pt.x / 540) * box.width,
    box.y + (pt.y / 1200) * box.height,
  );
}

async function waitForTarget(page, id, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await page.evaluate((targetId) => {
      const targets = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
      return Object.hasOwn(targets, targetId);
    }, id);
    if (ok) return;
    await wait(100);
  }
  throw new Error(`timeout waiting for ${id}`);
}

await withGamePreview(repoRoot, async ({ page, base }) => {
  await gotoTownReady(page, base);
  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.setSave({
      gold: 260,
      night: 6,
      talents: {
        ranks: {
          sharpened_edge: 3,
          heavy_swing: 2,
          wide_arc: 1,
          arcane_study: 2,
        },
        earned: 10,
      },
    });
  });
  await waitForTarget(page, "town-talents");
  await tapById(page, "town-talents");
  await waitForTarget(page, "talents-node-arcane_study");
  await tapById(page, "talents-node-arcane_study");
  await wait(400);

  const full = path.join(outDir, "talent-tree-after.png");
  await screenshotViewport(page, full);
  await page.screenshot({
    path: path.join(outDir, "talent-headers-crop.png"),
    clip: { x: 14, y: 176, width: 512, height: 58 },
  });
  await page.screenshot({
    path: path.join(outDir, "talent-rank-pill-crop.png"),
    clip: { x: 260, y: 812, width: 270, height: 56 },
  });
});

console.log(
  JSON.stringify({
    full: path.join(outDir, "talent-tree-after.png"),
    headers: path.join(outDir, "talent-headers-crop.png"),
    pill: path.join(outDir, "talent-rank-pill-crop.png"),
  }),
);
