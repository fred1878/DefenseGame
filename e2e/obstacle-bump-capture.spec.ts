import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense, e2eApi } from "./helpers/game";

/** boulderMed at tile (4, 10) — same framing as manual bump proofs. */
const TARGET_OBSTACLE_INDEX = 6;
const BUMP_PUSH_MS = 1_800;
const START_PAD_PX = 72;
const MEDIA_DIR =
  process.env.OBSTACLE_BUMP_MEDIA_DIR ??
  "/cursor/stores/bc-231c7aa6-7e8f-4ab4-8431-454b2117da2f/media";

type Cardinal = "north" | "south" | "east" | "west";

type BlockerAabb = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
};

const CARDINALS: Array<{
  name: Cardinal;
  stick: { dx: number; dy: number };
  start: (aabb: BlockerAabb, r: number) => { x: number; y: number };
}> = [
  {
    name: "north",
    stick: { dx: 0, dy: -1 },
    start: (aabb, r) => ({ x: aabb.cx, y: aabb.bottom + r + START_PAD_PX }),
  },
  {
    name: "south",
    stick: { dx: 0, dy: 1 },
    start: (aabb, r) => ({ x: aabb.cx, y: aabb.top - r - START_PAD_PX }),
  },
  {
    name: "east",
    stick: { dx: 1, dy: 0 },
    start: (aabb, r) => ({ x: aabb.left - r - START_PAD_PX, y: aabb.cy }),
  },
  {
    name: "west",
    stick: { dx: -1, dy: 0 },
    start: (aabb, r) => ({ x: aabb.right + r + START_PAD_PX, y: aabb.cy }),
  },
];

test.describe("obstacle bump — player stays outside blocker rect", () => {
  test.beforeEach(async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    const api = e2eApi(page);
    await api.eval<void>("api.setShowEnemyPaths(true)");
    await api.eval<void>("api.setShowHitboxes(true)");
    await api.eval<void>("api.setGodMode(false)");
  });

  test("Arcade static body AABB matches blocker overlay rect", async ({
    page,
  }) => {
    const api = e2eApi(page);
    const idx = TARGET_OBSTACLE_INDEX;
    const blocker = await api.eval<BlockerAabb & { w: number; h: number }>(
      `api.getObstacleBlockerAabb(${idx})`,
    );
    const arcade = await api.eval<BlockerAabb & { w: number; h: number }>(
      `api.getObstacleArcadeBodyAabb(${idx})`,
    );
    expect(Math.abs(blocker.left - arcade.left)).toBeLessThan(0.6);
    expect(Math.abs(blocker.top - arcade.top)).toBeLessThan(0.6);
    expect(Math.abs(blocker.right - arcade.right)).toBeLessThan(0.6);
    expect(Math.abs(blocker.bottom - arcade.bottom)).toBeLessThan(0.6);
  });

  for (const card of CARDINALS) {
    test(`stick push ${card.name} — no circle overlap into blue rect`, async ({
      page,
    }, testInfo) => {
      const api = e2eApi(page);
      const idx = TARGET_OBSTACLE_INDEX;
      const aabb = await api.eval<BlockerAabb>(
        `api.getObstacleBlockerAabb(${idx})`,
      );
      const r = await api.eval<number>("api.getPlayerBodyRadius()");
      const { x, y } = card.start(aabb, r);
      await api.eval<void>(`api.setPlayerPosition(${x}, ${y})`);
      const overlapAfterTeleport = await api.eval<number>(
        `api.getMaxPlayerObstacleOverlapPx(${idx})`,
      );
      expect(overlapAfterTeleport).toBeLessThan(0.5);

      await api.eval<void>(
        `api.setStick(${card.stick.dx}, ${card.stick.dy}, ${BUMP_PUSH_MS})`,
      );
      await page.waitForTimeout(120);

      const overlap = await api.eval<number>(
        `api.getMaxPlayerObstacleOverlapPx(${idx})`,
      );
      expect(overlap).toBeLessThan(0.5);

      const midX = (aabb.cx + x) / 2;
      const midY = (aabb.cy + y) / 2;
      await api.eval<void>(`api.centerDefenseCameraOn(${midX}, ${midY})`);
      await page.waitForTimeout(200);

      const shot = await page.screenshot({
        fullPage: false,
        animations: "disabled",
      });

      const basename = `obstacle-bump-${card.name}-2026-11-18-v2.png`;
      const artifactPath = path.join("/opt/cursor/artifacts", basename);
      fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
      fs.writeFileSync(artifactPath, shot);

      if (fs.existsSync(path.dirname(MEDIA_DIR))) {
        fs.mkdirSync(MEDIA_DIR, { recursive: true });
        fs.writeFileSync(path.join(MEDIA_DIR, basename), shot);
      }

      await testInfo.attach(basename, {
        body: shot,
        contentType: "image/png",
      });
    });
  }
});
