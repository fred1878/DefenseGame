import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { DEFENSE_OBSTACLES } from "../src/config/defense";
import { e2eApi, gotoE2E, startDefense } from "./helpers/game";

const VIEWPORT_CLIP = { x: 0, y: 0, width: 540, height: 1200 } as const;

test.describe("obstacle sprite vs blocking", () => {
  test("sprite display and physics match config colliders", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    const api = e2eApi(page);

    await api.eval<void>("api.setShowEnemyPaths(true)");
    await api.eval<void>(
      "api.setPlayerPosition(arg[0].x, arg[0].y + 80)",
      DEFENSE_OBSTACLES,
    );

    const rows = await api.eval<
      Array<{
        textureKey: string;
        configX: number;
        configY: number;
        configW: number;
        configH: number;
        spriteX: number;
        spriteY: number;
        displayW: number;
        displayH: number;
        bodyW: number;
        bodyH: number;
      }>
    >("api.getObstacleAlignment()");

    expect(rows.length).toBe(DEFENSE_OBSTACLES.length);

    for (const row of rows) {
      expect(Math.abs(row.spriteX - row.configX)).toBeLessThan(0.01);
      expect(Math.abs(row.spriteY - row.configY)).toBeLessThan(0.01);
      expect(Math.abs(row.displayW - row.configW)).toBeLessThan(0.51);
      expect(Math.abs(row.displayH - row.configH)).toBeLessThan(0.51);
      expect(Math.abs(row.bodyW - row.configW)).toBeLessThan(0.51);
      expect(Math.abs(row.bodyH - row.configH)).toBeLessThan(0.51);
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
});