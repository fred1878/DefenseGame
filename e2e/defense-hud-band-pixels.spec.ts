import { expect, test } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";
import {
  HUD_BAND_MIN_LUMINANCE,
  HUD_BAND_MIN_LUMINANCE_LIFT,
} from "./helpers/defenseHudBandPixels";

type PixelSample = { r: number; g: number; b: number; luminance: number };

function assertBandBrighterThanPlay(
  band: PixelSample,
  play: PixelSample,
  label: string,
): void {
  expect(
    band.luminance,
    `${label} luminance vs play area`,
  ).toBeGreaterThan(play.luminance + HUD_BAND_MIN_LUMINANCE_LIFT);
  expect(band.luminance, `${label} absolute luminance`).toBeGreaterThan(
    HUD_BAND_MIN_LUMINANCE,
  );
  expect(band.r, `${label} red channel`).toBeGreaterThan(52);
}

test.describe("defense HUD band pixels", () => {
  test("top and bottom bands are lighter than the play area", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    await page.evaluate(async () => {
      await window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(120, 0);
    });

  type HudBandSamples = Awaited<
    ReturnType<
      NonNullable<
        typeof window.__DEFENSEGAME_E2E__
      >["api"]["sampleDefenseHudBandPixelsAsync"]
    >
  >;

    let samples: HudBandSamples | null = null;

    await expect
      .poll(
        async () => {
          samples = await page.evaluate(async () =>
            window.__DEFENSEGAME_E2E__?.api?.sampleDefenseHudBandPixelsAsync(),
          );
          if (!samples) return false;
          const play = samples.playArea.luminance;
          return (
            samples.topBand.luminance > play + HUD_BAND_MIN_LUMINANCE_LIFT &&
            samples.bottomBand.luminance > play + HUD_BAND_MIN_LUMINANCE_LIFT &&
            samples.topBand.luminance >= HUD_BAND_MIN_LUMINANCE &&
            samples.bottomBand.luminance >= HUD_BAND_MIN_LUMINANCE &&
            samples.topBand.r > 52 &&
            samples.bottomBand.r > 52
          );
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    expect(samples).not.toBeNull();
    const s = samples!;

    assertBandBrighterThanPlay(s.topBand, s.playArea, "topBand");
    assertBandBrighterThanPlay(s.bottomBand, s.playArea, "bottomBand");
    expect(s.points.topBand.y).toBeLessThan(s.points.playArea.y);
    expect(s.points.bottomBand.y).toBeGreaterThan(s.points.playArea.y);
  });
});