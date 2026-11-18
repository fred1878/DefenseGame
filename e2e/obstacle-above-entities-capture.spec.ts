import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense, e2eApi } from "./helpers/game";

const OUT =
  process.env.OBSTACLE_ABOVE_ENTITIES_SHOT ??
  "/cursor/stores/self/media/obstacle-above-entities-2026-11-18-v1.png";

/**
 * Manual PR proof — cosmetic obstacle sprites above player/enemies.
 * `npm run build:e2e && npx playwright test e2e/obstacle-above-entities-capture.spec.ts --project=chromium`
 */
test.describe("@manual obstacle above entities capture", () => {
  test.skip(!!process.env.CI, "visual proof runs locally for PR attachments");

  test("player behind wide slab with debug overlays", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    const api = e2eApi(page);

    await api.eval<void>("api.setShowEnemyPaths(true)");
    await api.eval<void>("api.setShowHitboxes(true)");
    await api.eval<void>("api.setPlayerPosition(-256, -320)");

    await page.waitForTimeout(500);

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const shot = await page.screenshot({
      path: OUT,
      fullPage: false,
      animations: "disabled",
    });
    expect(shot.byteLength).toBeGreaterThan(10_000);
  });
});