#!/usr/bin/env node
/**
 * Proof clip: enemy melee VFX rotation left vs right (grunt, skirmisher, bruiser).
 *
 *   npm run build:e2e && node scripts/capture-melee-vfx-facing-demo.mjs
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

const DEFS = ["grunt", "skirmisher", "bruiser"];
const FACINGS = [
  { offX: 80, side: "R" },
  { offX: -80, side: "L" },
];
const HOLD_MS = 2000;

const defaultOut =
  process.env.MELEE_VFX_FACING_DEMO_OUT ??
  "/cursor/stores/bc-231c7aa6-7e8f-4ab4-8431-454b2117da2f/media/melee-vfx-flip-and-rotate-2026-11-25.webm";

function trimFromSec(inputWebm, outputWebm, startSec) {
  execSync(
    `ffmpeg -y -ss ${startSec.toFixed(3)} -i "${inputWebm}" -c:v libvpx-vp9 -crf 32 -b:v 1200k -an "${outputWebm}"`,
    { stdio: "inherit" },
  );
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

  const rotReport = [];
  for (const defId of DEFS) {
    for (const { offX, side } of FACINGS) {
      await page.evaluate(
        ({ id, ox }) => {
          window.__DEFENSEGAME_E2E__?.api?.clearEnemyMeleeFxFlag();
          window.__DEFENSEGAME_E2E__?.api?.showcaseEnemyMeleeSwipe(id, ox);
        },
        { id: defId, ox: offX },
      );
      await wait(300);
      const flags = await page.evaluate(() => ({
        rot: Number(window.__DEFENSEGAME_E2E__?.flags.lastEnemyMeleeFxRot),
        facing: Number(
          window.__DEFENSEGAME_E2E__?.flags.lastEnemyMeleeFxFacing,
        ),
        flipX: Number(window.__DEFENSEGAME_E2E__?.flags.lastEnemyMeleeFxFlipX),
        spawned: window.__DEFENSEGAME_E2E__?.flags.enemyMeleeFxSpawned,
        side: window.__DEFENSEGAME_E2E__?.flags.lastEnemyMeleeFxSide,
      }));
      rotReport.push({ defId, side, offX, ...flags });
      await wait(HOLD_MS);
    }
  }

  const video = page.video();
  await context.close();
  await browser.close();

  const rawPath = await video.path();
  trimFromSec(rawPath, defaultOut, defenseTrimSec);
  unlinkSync(rawPath);

  const angleDiff = (a, b) => {
    let d = Math.abs(a - b) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  };
  const pairDeltas = DEFS.map((defId) => {
    const right = rotReport.find((r) => r.defId === defId && r.side === "R");
    const left = rotReport.find((r) => r.defId === defId && r.side === "L");
    return {
      defId,
      facingDelta: angleDiff(right.facing, left.facing),
      rotDelta: angleDiff(right.rot, left.rot),
    };
  });

  const dur = parseFloat(
    execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${defaultOut}"`,
      { encoding: "utf8" },
    ).trim(),
  );

  console.log(
    JSON.stringify({
      filePath: defaultOut,
      durationSec: dur,
      defenseTrimSec,
      rotReport,
      pairDeltas,
    }),
  );
  const flipMismatch = rotReport.filter((r) => {
    if (r.defId === "grunt") return r.flipX !== 0;
    return (
      (r.side === "R" && r.flipX === 0) || (r.side === "L" && r.flipX !== 0)
    );
  });
  if (flipMismatch.length > 0) {
    console.error(
      "grunt: flipX must stay 0; other melee: flipX 1 for R (attack west), 0 for L:",
      flipMismatch,
    );
    process.exitCode = 1;
  }
} finally {
  preview.kill();
}
