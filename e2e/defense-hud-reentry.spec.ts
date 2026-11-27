/**
 * Guards a0ccd60: after Defense -> Town -> Defense, HUD chrome built on the
 * second entry was adopted into the world layer that the UI camera ignores,
 * so the top band rendered empty. Theme-independent: on both entries each
 * band must hold HUD content (not just its background colour), and the
 * second entry must look like the first.
 */
import { expect, type Page, test } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";

const GAME_W = 540;
const GAME_H = 1200;
/**
 * Share of band pixels that differ clearly from the band background. The
 * dark HUD measures about 0.28 (top) and 0.44 (bottom); with the HUD hidden
 * under the world layer the top band drops to about 0.02.
 */
const MIN_CONTENT = 0.1;

async function waitFrames(page: Page, frames: number): Promise<void> {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let left = n;
        const step = (): void => {
          left -= 1;
          if (left <= 0) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    frames,
  );
}

type BandPixels = { top: string; bottom: string };
type BandStats = { contentFraction: number };

async function captureHudBands(page: Page): Promise<BandPixels> {
  const probe = await page.evaluate(
    () => window.__DEFENSEGAME_E2E__?.api?.getDefenseHudLayoutProbe()?.playArea,
  );
  if (!probe) throw new Error("HUD layout probe missing");
  const box = await page.locator("#game canvas").boundingBox();
  if (!box) throw new Error("Canvas bounding box missing");
  const sx = box.width / GAME_W;
  const sy = box.height / GAME_H;
  const shot = async (y0: number, y1: number): Promise<string> =>
    (
      await page.screenshot({
        clip: {
          x: box.x,
          y: box.y + y0 * sy,
          width: GAME_W * sx,
          height: (y1 - y0) * sy,
        },
      })
    ).toString("base64");
  return {
    top: await shot(0, probe.topBandBottom),
    bottom: await shot(probe.bottomBandTop, GAME_H),
  };
}

/**
 * Decode two same-size PNGs in the page: mean abs RGB diff (0..255) and the
 * share of `b` that is not the band background (an empty band is ~0).
 */
async function compareBands(
  page: Page,
  a: string,
  b: string,
): Promise<{ meanDiff: number } & BandStats> {
  return page.evaluate(
    async ([pa, pb]) => {
      const decode = async (b64: string): Promise<ImageData> => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("2d context missing");
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height);
      };
      const da = await decode(pa);
      const db = await decode(pb);
      const n = Math.min(da.data.length, db.data.length);
      // Background = most common colour (4-bit quantised) in `b`.
      const counts = new Map<number, number>();
      for (let i = 0; i < n; i += 4) {
        const key =
          ((db.data[i] ?? 0) >> 4) * 256 +
          ((db.data[i + 1] ?? 0) >> 4) * 16 +
          ((db.data[i + 2] ?? 0) >> 4);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      let bgKey = 0;
      let bgCount = -1;
      for (const [k, c] of counts) {
        if (c > bgCount) {
          bgKey = k;
          bgCount = c;
        }
      }
      const bg = [
        (Math.floor(bgKey / 256) << 4) + 8,
        ((Math.floor(bgKey / 16) % 16) << 4) + 8,
        ((bgKey % 16) << 4) + 8,
      ];
      let diff = 0;
      let content = 0;
      for (let i = 0; i < n; i += 4) {
        const r = db.data[i] ?? 0;
        const g = db.data[i + 1] ?? 0;
        const bl = db.data[i + 2] ?? 0;
        diff +=
          Math.abs((da.data[i] ?? 0) - r) +
          Math.abs((da.data[i + 1] ?? 0) - g) +
          Math.abs((da.data[i + 2] ?? 0) - bl);
        const far = Math.max(
          Math.abs(r - (bg[0] ?? 0)),
          Math.abs(g - (bg[1] ?? 0)),
          Math.abs(bl - (bg[2] ?? 0)),
        );
        if (far > 40) content++;
      }
      const px = n / 4;
      return { meanDiff: diff / (px * 3), contentFraction: content / px };
    },
    [a, b] as const,
  );
}

test.describe("defense HUD re-entry", () => {
  test("HUD bands look the same after a town round-trip", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    let first: BandPixels | null = null;
    await expect
      .poll(
        async () => {
          await waitFrames(page, 5);
          const bands = await captureHudBands(page);
          const top = await compareBands(page, bands.top, bands.top);
          const bottom = await compareBands(page, bands.bottom, bands.bottom);
          first = bands;
          return (
            top.contentFraction > MIN_CONTENT &&
            bottom.contentFraction > MIN_CONTENT
          );
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    if (!first) throw new Error("first-entry HUD capture missing");
    const firstBands: BandPixels = first;

    await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.returnToTown());
    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__DEFENSEGAME_E2E__?.scene === "Town"),
        { timeout: 15_000 },
      )
      .toBe(true);
    await startDefense(page);

    // Timers and bars move a little between captures, so allow small drift.
    await expect
      .poll(
        async () => {
          await waitFrames(page, 5);
          const second = await captureHudBands(page);
          const top = await compareBands(page, firstBands.top, second.top);
          const bottom = await compareBands(
            page,
            firstBands.bottom,
            second.bottom,
          );
          return (
            top.meanDiff < 12 &&
            bottom.meanDiff < 12 &&
            top.contentFraction > MIN_CONTENT &&
            bottom.contentFraction > MIN_CONTENT
          );
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });
});
