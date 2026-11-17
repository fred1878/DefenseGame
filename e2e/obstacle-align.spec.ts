import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  DEFENSE_OBSTACLES,
  DEFENSE_OBSTACLE_PLACEMENTS,
  defenseObstacleSpriteAnchor,
} from "../src/config/defense";
import { e2eApi, gotoE2E, startDefense } from "./helpers/game";

const VIEWPORT_CLIP = { x: 0, y: 0, width: 540, height: 1200 } as const;
const EDGE_TOL_PX = 1;

type ObstacleAlignRow = {
  textureKey: string;
  configX: number;
  configY: number;
  configW: number;
  configH: number;
  configLeft: number;
  configTop: number;
  configRight: number;
  configBottom: number;
  anchorX: number;
  anchorY: number;
  spriteX: number;
  spriteY: number;
  displayW: number;
  displayH: number;
  bodyW: number;
  bodyH: number;
  bodyCenterX: number;
  bodyCenterY: number;
  boundsLeft: number;
  boundsTop: number;
  boundsRight: number;
  boundsBottom: number;
};

test.describe("obstacle sprite vs blocking", () => {
  test("Arcade getBounds matches PathDebug / DEFENSE_OBSTACLES rects", async ({
    page,
  }) => {
    await gotoE2E(page);
    await startDefense(page);
    const api = e2eApi(page);

    await api.eval<void>("api.setShowEnemyPaths(true)");
    await api.eval<void>(
      "api.setPlayerPosition(arg[0].x, arg[0].y + 80)",
      DEFENSE_OBSTACLES,
    );

    const rows = await api.eval<ObstacleAlignRow[]>("api.getObstacleAlignment()");

    expect(rows.length).toBe(DEFENSE_OBSTACLES.length);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const anchor = defenseObstacleSpriteAnchor(DEFENSE_OBSTACLE_PLACEMENTS[i]!);
      expect(Math.abs(row.spriteX - anchor.x)).toBeLessThan(0.01);
      expect(Math.abs(row.spriteY - anchor.y)).toBeLessThan(0.01);
      expect(Math.abs(row.bodyW - row.configW)).toBeLessThanOrEqual(EDGE_TOL_PX);
      expect(Math.abs(row.bodyH - row.configH)).toBeLessThanOrEqual(EDGE_TOL_PX);

      expect(Math.abs(row.boundsLeft - row.configLeft)).toBeLessThanOrEqual(
        EDGE_TOL_PX,
      );
      expect(Math.abs(row.boundsTop - row.configTop)).toBeLessThanOrEqual(
        EDGE_TOL_PX,
      );
      expect(Math.abs(row.boundsRight - row.configRight)).toBeLessThanOrEqual(
        EDGE_TOL_PX,
      );
      expect(Math.abs(row.boundsBottom - row.configBottom)).toBeLessThanOrEqual(
        EDGE_TOL_PX,
      );

      const boundsCx = (row.boundsLeft + row.boundsRight) / 2;
      const boundsCy = (row.boundsTop + row.boundsBottom) / 2;
      expect(Math.abs(boundsCx - row.configX)).toBeLessThanOrEqual(EDGE_TOL_PX);
      expect(Math.abs(boundsCy - row.configY)).toBeLessThanOrEqual(EDGE_TOL_PX);
      expect(Math.abs(boundsCx - row.bodyCenterX)).toBeLessThanOrEqual(EDGE_TOL_PX);
      expect(Math.abs(boundsCy - row.bodyCenterY)).toBeLessThanOrEqual(EDGE_TOL_PX);

      expect(row.bodyW).toBeLessThanOrEqual(row.displayW + 0.51);
      expect(row.bodyH).toBeLessThanOrEqual(row.displayH + 0.51);
      expect(row.displayW).toBeGreaterThan(row.bodyW);
      expect(row.displayH).toBeGreaterThan(row.bodyH);
    }
  });

  test("debug overlay screenshot at wide slab", async ({ page }, testInfo) => {
    await gotoE2E(page);
    await startDefense(page);
    const api = e2eApi(page);
    const slab = DEFENSE_OBSTACLES[0]!;

    await api.eval<void>("api.setShowEnemyPaths(true)");
    await api.eval<void>(
      "api.setPlayerPosition(arg.x, arg.y + 72)",
      slab,
    );
    await page.waitForTimeout(200);

    const shot = await page.screenshot({ clip: VIEWPORT_CLIP });
    const outDir = path.join(testInfo.project.outputDir, "obstacle-align");
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, "wide-slab-overlay.png");
    fs.writeFileSync(file, shot);
    testInfo.attach("wide-slab-overlay", {
      path: file,
      contentType: "image/png",
    });
    expect(shot.byteLength).toBeGreaterThan(8_000);
  });

  test("obstacle feet on tile center with hitboxes on", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    const api = e2eApi(page);
    await api.eval<void>("api.setShowHitboxes(true)");
    const rows = await api.eval<ObstacleAlignRow[]>("api.getObstacleAlignment()");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const anchor = defenseObstacleSpriteAnchor(DEFENSE_OBSTACLE_PLACEMENTS[i]!);
      expect(Math.abs(row.spriteY - anchor.y)).toBeLessThan(0.01);
      const feetY = row.spriteY + row.displayH / 2;
      const bodyBottom = row.boundsBottom;
      expect(Math.abs(bodyBottom - feetY)).toBeLessThan(1.01);
      expect(Math.abs(bodyBottom - (row.configY + row.configH / 2))).toBeLessThanOrEqual(
        EDGE_TOL_PX,
      );
      const bodyTop = row.boundsTop;
      expect(bodyTop).toBeGreaterThan(row.spriteY - row.displayH / 2 - 0.51);
    }
  });
});