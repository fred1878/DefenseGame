/**
 * World draw is limited to the play-area viewport (not full canvas).
 */
import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";

test.describe("@manual defense play area viewport", () => {
  test("world points project only inside the play band", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);

    const samples = await page.evaluate(async () => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      if (!api) return null;
      const play = api.getDefenseHudLayoutProbe()?.playArea;
      if (!play) return null;
      const top = play.y;
      const bottom = play.y + play.height;
      const tol = 6;

      const player = window.__DEFENSEGAME_E2E__?.player;
      const points: Array<{ label: string; sx: number; sy: number }> = [];
      if (player) {
        const p = api.worldPointToDefenseScreen(player.x, player.y);
        points.push({ label: "player", sx: p.x, sy: p.y });
      }

      await api.spawnTestEnemy(100, 60);
      await new Promise((r) => setTimeout(r, 80));
      const p2 = window.__DEFENSEGAME_E2E__?.player;
      if (p2) {
        const e = api.worldPointToDefenseScreen(p2.x + 100, p2.y + 60);
        points.push({ label: "enemy", sx: e.x, sy: e.y });
      }

      const bandSample = await api.sampleDefenseHudBandPixelsAsync();
      return { top, bottom, tol, points, bandSample };
    });

    expect(samples).not.toBeNull();
    for (const pt of samples!.points) {
      expect(
        pt.sy,
        `${pt.label} screen Y=${pt.sy} outside play band [${samples!.top}, ${samples!.bottom}]`,
      ).toBeGreaterThanOrEqual(samples!.top - samples!.tol);
      expect(pt.sy).toBeLessThanOrEqual(samples!.bottom + samples!.tol);
    }

    expect(samples!.bandSample?.points.topBand.y).toBeLessThan(samples!.top);
    expect(samples!.bandSample?.points.bottomBand.y).toBeGreaterThan(
      samples!.bottom,
    );
  });
});