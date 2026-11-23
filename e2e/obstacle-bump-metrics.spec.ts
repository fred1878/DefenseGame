import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense, e2eApi } from "./helpers/game";

const TARGET_OBSTACLE_INDEX = 6;
const BEYOND_FLUSH_PX = 5;
const NUDGE_MS = 12;
const MOVE_SPEED = 90;
const MEDIA_DIR =
  process.env.OBSTACLE_BUMP_MEDIA_DIR ??
  "/cursor/stores/bc-231c7aa6-7e8f-4ab4-8431-454b2117da2f/media";

type Cardinal = "north" | "south" | "east" | "west";

const STICKS: Record<Cardinal, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
};

test.describe("@manual obstacle bump metrics capture", () => {
  test("write obstacle-bump-metrics-2026-11-18-v2.json", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    const api = e2eApi(page);
    await api.eval<void>("api.setGodMode(false)");
    await api.eval<void>(`api.setPlayerMoveSpeedWu(${MOVE_SPEED})`);

    const blocker = await api.eval<{
      cx: number;
      cy: number;
      w: number;
      h: number;
    }>(`api.getObstacleBlockerAabb(${TARGET_OBSTACLE_INDEX})`);

    const metrics: Record<string, unknown> = {
      build: "e2e-local",
      moveSpeed: MOVE_SPEED,
      nudgeMs: NUDGE_MS,
      beyondFlushPx: BEYOND_FLUSH_PX,
      obstacleIndex: TARGET_OBSTACLE_INDEX,
      boulder: {
        x: blocker.cx,
        y: blocker.cy,
        w: blocker.w,
        h: blocker.h,
        tile: { tileX: 4, tileY: 10 },
        textureKey: "obstacle_boulder_med",
      },
    };

    for (const approach of Object.keys(STICKS) as Cardinal[]) {
      await page.reload({ waitUntil: "networkidle" });
      await expect
        .poll(
          async () =>
            page.evaluate(
              () =>
                window.__DEFENSEGAME_E2E__?.scene === "Town" &&
                window.__DEFENSEGAME_E2E__?.ready === true,
            ),
          { timeout: 45_000 },
        )
        .toBe(true);
      await startDefense(page);
      await api.eval<void>("api.setGodMode(false)");
      await api.eval<void>(`api.setPlayerMoveSpeedWu(${MOVE_SPEED})`);

      const start = await api.eval<{ x: number; y: number }>(
        `api.getFlushTangentPosition(${TARGET_OBSTACLE_INDEX}, ${JSON.stringify(approach)}, ${BEYOND_FLUSH_PX})`,
      );
      await api.eval<void>(`api.setPlayerPosition(${start.x}, ${start.y})`);

      let peakPenetrationDuringPush = 0;
      for (let i = 0; i < 32; i++) {
        const stick = STICKS[approach];
        await api.eval<void>(
          `api.setStick(${stick.dx}, ${stick.dy}, ${NUDGE_MS})`,
        );
        const pen = await api.eval<number>(
          `api.getMaxPlayerObstacleOverlapPx(${TARGET_OBSTACLE_INDEX})`,
        );
        peakPenetrationDuringPush = Math.max(peakPenetrationDuringPush, pen);
        const edgeErr = await api.eval<number>(
          `api.getObstacleBumpProbe(${TARGET_OBSTACLE_INDEX}, ${JSON.stringify(approach)}).edgeErrPx`,
        );
        if (pen <= 0.001 && edgeErr >= -0.05 && edgeErr <= 0.05) {
          break;
        }
      }
      await api.eval<void>("api.clearStick()");
      await page.waitForTimeout(120);
      await api.eval<void>("api.resolvePlayerObstacleOverlap()");

      const probe = await api.eval<{
        player: { x: number; y: number };
        edgeErrPx: number;
        penetrationPx: number;
        surfaceGapPx: number;
        pastCenter: boolean;
      }>(
        `api.getObstacleBumpProbe(${TARGET_OBSTACLE_INDEX}, ${JSON.stringify(approach)})`,
      );

      metrics[approach] = {
        player: probe.player,
        start,
        edgeErrPx: probe.edgeErrPx,
        penetrationPx: probe.penetrationPx,
        surfaceGapPx: probe.surfaceGapPx,
        peakPenetrationDuringPushPx: peakPenetrationDuringPush,
        pastCenter: probe.pastCenter,
        inPlayBand: true,
      };

      expect(probe.penetrationPx).toBeLessThan(0.5);
      expect(peakPenetrationDuringPush).toBeLessThan(0.75);
    }

    metrics.pr163Baseline = {
      note: "Measured on main/PR163 body lock without world-step separation",
      south: { peakPenetrationDuringPushPx: 2.33 },
      north: { surfaceGapPx: 1.3333333333333357, edgeErrPx: 1.3333333333333357 },
    };

    const outPath = path.join(MEDIA_DIR, "obstacle-bump-metrics-2026-11-18-v2.json");
    const artifactPath = path.join(
      "/opt/cursor/artifacts",
      "obstacle-bump-metrics-2026-11-18-v2.json",
    );
    const json = `${JSON.stringify(metrics, null, 2)}\n`;
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, json);
    if (fs.existsSync(path.dirname(MEDIA_DIR))) {
      fs.mkdirSync(MEDIA_DIR, { recursive: true });
      fs.writeFileSync(outPath, json);
    }

    const south = metrics.south as { peakPenetrationDuringPushPx: number };
    const north = metrics.north as { surfaceGapPx: number; edgeErrPx: number };
    expect(south.peakPenetrationDuringPushPx).toBeLessThan(0.75);
    expect(Math.abs(north.edgeErrPx)).toBeLessThan(0.25);
  });
});