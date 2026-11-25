#!/usr/bin/env node
/**
 * Defense-only viewport capture for human review (not CI).
 *
 * Usage: npm run build:e2e && node scripts/capture-defense-hud.mjs
 *
 * Prefer `capture-ui-visual.mjs` for town + defense in one run.
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
  await gotoDefenseReady(page);
  const outPath = reviewCapturePath("defense", sha);
  await screenshotViewport(page, outPath);
  reportCapture("defense", outPath);
});

process.exit(process.exitCode ?? 0);
