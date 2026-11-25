import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { gotoE2E, startDefense, e2eApi } from "./helpers/game";

const MEDIA_DIR =
  process.env.OBSTACLE_CAPTURE_DIR ?? "/cursor/stores/self/media";

/**
 * One-off Peter proof — run locally after obstacle cosmetic Y change.
 * `npm run build:e2e && npx playwright test e2e/obstacle-sprite-y6-capture.spec.ts --project=chromium`
 */
test.describe("@manual obstacle sprite y+6 capture", () => {
  test.skip(!!process.env.CI, "capture runs locally for PR attachments");

  const shots: { name: string; x: number; y: number }[] = [
    { name: "defense-wide-slab", x: -256, y: -320 },
    { name: "defense-boulder-cluster", x: 48, y: 96 },
  ];

  for (const { name, x, y } of shots) {
    test(`capture ${name}`, async ({ page }) => {
      await gotoE2E(page);
      await startDefense(page);
      const api = e2eApi(page);

      await api.eval<void>("api.setShowEnemyPaths(true)");
      await api.eval<void>("api.setShowHitboxes(true)");
      await api.eval<void>(`api.setPlayerPosition(${x}, ${y})`);

      await page.waitForTimeout(500);

      const out = path.join(
        MEDIA_DIR,
        `obstacle-sprite-y6-${name}-2026-11-18.png`,
      );
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await page.screenshot({
        path: out,
        fullPage: false,
        animations: "disabled",
      });
    });
  }
});
