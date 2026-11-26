#!/usr/bin/env node
/**
 * Blacksmith, Inventory, and Talents panel captures for review / PR attachments.
 *
 * Usage: npm run build:e2e && node scripts/capture-gear-panels.mjs
 *
 * Writes PNGs to /opt/cursor/artifacts/{blacksmith,inventory,talent-tree}.png
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
  const x = box.x + (pt.x / 540) * box.width;
  const y = box.y + (pt.y / 1200) * box.height;
  await page.mouse.click(x, y);
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

  // Blacksmith
  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.setSave({ gold: 140, night: 2 });
  });
  await waitForTarget(page, "town-building-town_special_moon_brazier");
  await tapById(page, "town-building-town_special_moon_brazier");
  await waitForTarget(page, "shop-card-0");
  await tapById(page, "shop-card-0");
  await wait(400);
  await screenshotViewport(page, path.join(outDir, "blacksmith.png"));

  // Close shop
  await waitForTarget(page, "shop-close");
  await tapById(page, "shop-close");
  await waitForTarget(page, "town-gear");

  // Inventory
  await page.evaluate(() => {
    const item = (uid, baseId, rarity, lvl) => ({
      uid,
      baseId,
      rarity,
      itemLevel: lvl,
      affixes: [],
    });
    window.__DEFENSEGAME_E2E__?.api?.setSave({
      gold: 260,
      night: 4,
      consumables: { minor_healing_potion: 2 },
      gear: {
        items: [
          item(1, "iron_sword", "common", 3),
          item(2, "leather_cap", "common", 2),
          item(3, "short_bow", "magic", 3),
          item(4, "padded_vest", "rare", 4),
          item(5, "worn_boots", "common", 2),
        ],
        equipped: { meleeWeapon: 1, helm: 2 },
        nextUid: 6,
      },
    });
  });
  await tapById(page, "town-gear");
  await waitForTarget(page, "inv-bag-0");
  await tapById(page, "inv-bag-0");
  await wait(400);
  await screenshotViewport(page, path.join(outDir, "inventory.png"));
  await waitForTarget(page, "inv-close");
  await tapById(page, "inv-close");

  // Talents
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
  await screenshotViewport(page, path.join(outDir, "talent-tree.png"));
});

console.log(
  JSON.stringify({
    blacksmith: path.join(outDir, "blacksmith.png"),
    inventory: path.join(outDir, "inventory.png"),
    talentTree: path.join(outDir, "talent-tree.png"),
  }),
);
