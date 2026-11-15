import { expect, type Page, type TestInfo } from "@playwright/test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

export type ViewportClip = { x: number; y: number; width: number; height: number };

type ViewportScreenshotOptions = {
  clip: ViewportClip;
  maxDiffPixelRatio?: number;
};

/**
 * Viewport screenshot with logged baseline path. Set `VISUAL_EXPECT_UI_CHANGE=1` on UI PRs
 * (not on main/CI) to warn when the live capture is byte-identical to the committed baseline.
 */
export async function expectViewportScreenshot(
  page: Page,
  testInfo: TestInfo,
  snapshotName: string,
  options: ViewportScreenshotOptions,
): Promise<void> {
  const snapshotPath = testInfo.snapshotPath(snapshotName);
  console.log(`[visual] committed baseline: ${snapshotPath}`);

  if (process.env.VISUAL_EXPECT_UI_CHANGE === "1" && existsSync(snapshotPath)) {
    const baseline = await readFile(snapshotPath);
    const current = await page.screenshot({ clip: options.clip, type: "png" });
    if (baseline.equals(current)) {
      console.warn(
        `[visual] VISUAL_EXPECT_UI_CHANGE=1 but "${snapshotName}" matches the committed baseline byte-for-byte. ` +
          `CI uses --project=chromium; update and commit files under e2e/visual.spec.ts-snapshots/ ` +
          `(npm run build:e2e && npx playwright test e2e/visual.spec.ts --project=chromium --update-snapshots).`,
      );
    }
  }

  // Semi-transparent DOM tap mirrors sit above the canvas; hide them so pixels
  // match Phaser-only baselines (order-dependent mirror layout caused CI drift).
  await page.evaluate(() => {
    const root = document.getElementById("defensegame-e2e-dom");
    if (root) root.style.visibility = "hidden";
  });
  const ratio = options.maxDiffPixelRatio;
  const pixelBudget =
    ratio !== undefined
      ? Math.ceil(options.clip.width * options.clip.height * ratio)
      : undefined;
  try {
    await expect(page).toHaveScreenshot(snapshotName, {
      clip: options.clip,
      ...(ratio !== undefined ? { maxDiffPixelRatio: ratio, maxDiffPixels: pixelBudget } : {}),
    });
  } finally {
    await page.evaluate(() => {
      const root = document.getElementById("defensegame-e2e-dom");
      if (root) root.style.visibility = "";
    });
  }
}