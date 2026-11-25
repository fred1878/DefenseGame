#!/usr/bin/env node
/**
 * Defense-only enemy melee swipe demo (Playwright recordVideo + trim).
 *
 *   npm run build:e2e && node scripts/capture-melee-enemy-vfx-demo.mjs
 */
import { mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";
import {
  gotoDefenseReady,
  gotoTownReady,
  VIEWPORT,
  wait,
  waitForHttp,
} from "./lib/capture-preview.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const ENEMY_MELEE_DEFS = [
  "grunt",
  "skirmisher",
  "bruiser",
  "slow_siege",
  "fast_sapper",
  "charger",
  "ward",
  "reaver",
];

const SWIPE_POLL_MS = 1800;
const HOLD_AFTER_SWIPE_MS = 1100;
const SPAWN_FACINGS = [
  { offX: 44, side: "enemyRight" },
  { offX: -44, side: "enemyLeft" },
];
const HOLD_PLAYER_MS = 2000;

const defaultOut =
  process.env.MELEE_VFX_DEMO_OUT ??
  "/cursor/stores/bc-231c7aa6-7e8f-4ab4-8431-454b2117da2f/media/melee-vfx-in-game-demo.webm";

function trimFromSec(inputWebm, outputWebm, startSec) {
  execSync(
    `ffmpeg -y -ss ${startSec.toFixed(3)} -i "${inputWebm}" -c:v libvpx-vp9 -crf 32 -b:v 1200k -an "${outputWebm}"`,
    { stdio: "inherit" },
  );
}

async function enemySwipeSeen(page, defId) {
  return page.evaluate(
    (id) =>
      Number(window.__DEFENSEGAME_E2E__?.flags.enemyMeleeFxSpawned) === 1 &&
      window.__DEFENSEGAME_E2E__?.flags.lastEnemyMeleeFxDef === id,
    defId,
  );
}

async function pollEnemySwipe(page, defId) {
  const deadline = Date.now() + SWIPE_POLL_MS;
  while (Date.now() < deadline) {
    if (await enemySwipeSeen(page, defId)) return "spawn";
    await wait(80);
  }
  await page.evaluate((id) => {
    window.__DEFENSEGAME_E2E__?.api?.previewEnemyMeleeFx(id);
  }, defId);
  const after = Date.now() + 900;
  while (Date.now() < after) {
    if (await enemySwipeSeen(page, defId)) return "preview";
    await wait(80);
  }
  return "miss";
}

execSync("npm run build:e2e", { cwd: repoRoot, stdio: "inherit" });

const port = process.env.CAPTURE_PORT ?? "4199";
const base = `http://127.0.0.1:${port}`;
const preview = spawn(
  "npm",
  ["run", "preview", "--", "--port", String(port), "--host", "127.0.0.1"],
  {
    cwd: repoRoot,
    env: { ...process.env, VITE_BASE: "/" },
    stdio: "ignore",
  },
);

try {
  await waitForHttp(`${base}/`);

  mkdirSync(path.dirname(defaultOut), { recursive: true });
  const videoDir = path.join(repoRoot, ".capture-videos");
  mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch();
  const recordStartMs = Date.now();
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: VIEWPORT,
    recordVideo: { dir: videoDir, size: VIEWPORT },
  });
  const page = await context.newPage();

  await page.goto(`${base}/?e2e=1`, { waitUntil: "networkidle" });
  await gotoTownReady(page, base);
  await gotoDefenseReady(page, { spawnWarmupEnemy: false });
  const defenseTrimSec = Math.max(
    0,
    (Date.now() - recordStartMs) / 1000 - 0.15,
  );

  await page.evaluate(() => {
    const api = window.__DEFENSEGAME_E2E__?.api;
    api?.setGodMode(true);
    api?.setManualReturnToTown(true);
    api?.setShowHitboxes(false);
    api?.setShowTouchInput(false);
    api?.centerDefenseCameraOn(0, 80);
    api?.setPlayerPosition(0, 80);
  });
  await wait(200);

  const swipeSources = [];
  for (const defId of ENEMY_MELEE_DEFS) {
    for (const { offX, side } of SPAWN_FACINGS) {
      await page.evaluate(
        ({ id, ox }) => {
          const api = window.__DEFENSEGAME_E2E__?.api;
          api?.clearEnemyMeleeFxFlag();
          api?.setSpawnPlanComplete(false);
          api?.killAllEnemies();
          api?.spawnTestEnemyByDef(id, ox, 0);
        },
        { id: defId, ox: offX },
      );
      const stillDefense = await page.evaluate(
        () => window.__DEFENSEGAME_E2E__?.scene === "Defense",
      );
      if (!stillDefense) {
        throw new Error("Left Defense scene during capture (night end?)");
      }
      const src = await pollEnemySwipe(page, defId);
      swipeSources.push({ defId, side, src });
      await wait(HOLD_AFTER_SWIPE_MS);
    }
  }

  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.killAllEnemies();
    window.__DEFENSEGAME_E2E__?.api?.tapMelee();
  });
  await wait(HOLD_PLAYER_MS);

  const video = page.video();
  await context.close();
  await browser.close();

  const rawPath = await video.path();
  trimFromSec(rawPath, defaultOut, defenseTrimSec);
  unlinkSync(rawPath);

  const dur = parseFloat(
    execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${defaultOut}"`,
      { encoding: "utf8" },
    ).trim(),
  );
  const misses = swipeSources.filter((s) => s.src === "miss");

  console.log(
    JSON.stringify({
      filePath: defaultOut,
      durationSec: dur,
      defenseTrimSec,
      swipeSources,
    }),
  );
  if (misses.length > 0) {
    console.error("No melee swipe for:", misses.map((m) => m.defId).join(", "));
    process.exitCode = 1;
  }
} finally {
  preview.kill();
}
