import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense, e2eApi } from "./helpers/game";

/**
 * Manual / PR proof only — do not rely on for CI.
 * Run: `npm run build:e2e && npx playwright test e2e/obstacle-v2-visual-proof.spec.ts --project=mobile-chrome`
 */
test.describe("@manual obstacle v2 overlay proof", () => {
  test.skip(!!process.env.CI, "visual proof runs locally for PR attachments");

  test("enemy paths + hitboxes on wide slab", async ({ page }, testInfo) => {
    await gotoE2E(page);
    await startDefense(page);
    const api = e2eApi(page);

    await api.eval<void>("api.setShowEnemyPaths(true)");
    await api.eval<void>("api.setShowHitboxes(true)");
    await api.eval<void>("api.setPlayerPosition(-256, -320)");

    await page.waitForTimeout(400);
    const shot = await page.screenshot({
      fullPage: false,
      animations: "disabled",
    });
    const artifactPath =
      "/opt/cursor/artifacts/obstacle-v2-mobile-overlays.png";
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, shot);
    await testInfo.attach("obstacle-v2-defense-overlays", {
      body: shot,
      contentType: "image/png",
    });
    expect(shot.byteLength).toBeGreaterThan(10_000);
  });
});
