#!/usr/bin/env node
/**
 * Town + defense viewport captures for human review (not CI).
 *
 * Usage: npm run build:e2e && node scripts/capture-ui-visual.mjs
 *
 * Writes unique PNGs under /opt/cursor/artifacts/review/ and prints one JSON
 * object per scene on stdout: { path, md5, md5ChangedFromLastRun }.
 */
import { fileURLToPath } from "node:url";
import {
  gitShortSha,
  gotoDefenseReady,
  gotoTownReady,
  screenshotViewport,
  withGamePreview,
} from "./lib/capture-preview.mjs";
import { reportCapture, reviewCapturePath } from "./lib/capture-review.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const sha = gitShortSha(repoRoot);

await withGamePreview(repoRoot, async ({ page, base }) => {
  await gotoTownReady(page, base);
  const townPath = reviewCapturePath("town", sha);
  await screenshotViewport(page, townPath);
  reportCapture("town", townPath);

  await gotoDefenseReady(page);
  const defensePath = reviewCapturePath("defense", sha);
  await screenshotViewport(page, defensePath);
  reportCapture("defense", defensePath);
});

process.exit(process.exitCode ?? 0);
