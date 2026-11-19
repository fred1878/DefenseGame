import { expect, test } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";
import {
  HUD_BAND_MIN_LUMINANCE,
  HUD_BAND_MIN_LUMINANCE_LIFT,
} from "./helpers/defenseHudBandPixels";

async function waitForHudBands(page: import("@playwright/test").Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const samples = await page.evaluate(async () =>
          window.__DEFENSEGAME_E2E__?.api?.sampleDefenseHudBandPixelsAsync(),
        );
        if (!samples) return false;
        const play = samples.playArea.luminance;
        return (
          samples.topBand.luminance > play + HUD_BAND_MIN_LUMINANCE_LIFT &&
          samples.bottomBand.luminance > play + HUD_BAND_MIN_LUMINANCE_LIFT &&
          samples.topBand.luminance >= HUD_BAND_MIN_LUMINANCE &&
          samples.topBand.r > 52
        );
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

test.describe("defense HUD re-entry", () => {
  test("top HUD band stays visible after town round-trip", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.returnToTown());
    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__DEFENSEGAME_E2E__?.scene === "Town"),
        { timeout: 15_000 },
      )
      .toBe(true);
    await startDefense(page);
    await waitForHudBands(page);
  });
});