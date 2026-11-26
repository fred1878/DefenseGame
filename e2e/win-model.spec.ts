import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { SaveGame } from "../src/core/saveTypes";

/**
 * Win-model validation (@manual, see docs/ECONOMY_SIM.md): replays sim
 * starting saves from `node scripts/win-model-snapshots.mjs` in the real game
 * with the campaign wave running (`campaignWaves=1`) and a simple bot that
 * walks auto-attack + auto-cast toward the enemy nearest the wall. Results go
 * to sim-output/win-model-results.jsonl for comparison with the predicted
 * win chance.
 *
 *   WIN_MODEL_REPEATS=3 npx playwright test e2e/win-model.spec.ts --workers 8
 */

type Snapshot = {
  id: string;
  night: number;
  tier: string;
  save: SaveGame;
  mode: "melee" | "ranged";
  pressure: { powerRatio: number; winChance: number };
};

const root = process.cwd();
const snapshotFile =
  process.env.WIN_MODEL_SNAPSHOTS ??
  path.join(root, "sim-output/win-model-snapshots.json");
const resultsFile = process.env.WIN_MODEL_RESULTS ??
  path.join(root, "sim-output/win-model-results.jsonl");
const snapshots: Snapshot[] = fs.existsSync(snapshotFile)
  ? (JSON.parse(fs.readFileSync(snapshotFile, "utf8")) as Snapshot[])
  : [];
const repeats = Number(process.env.WIN_MODEL_REPEATS ?? "1");

async function waitForTown(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            window.__DEFENSEGAME_E2E__?.ready === true &&
            window.__DEFENSEGAME_E2E__?.scene === "Town" &&
            window.__DEFENSEGAME_E2E__?.assetsLoaded === true,
        ),
      { timeout: 60_000 },
    )
    .toBe(true);
}

async function bootCampaignNight(page: Page, save: SaveGame): Promise<void> {
  await page.goto("/?e2e=1&campaignWaves=1", { waitUntil: "networkidle" });
  await waitForTown(page);
  // Town keeps its own save copy, so persist the snapshot and reload.
  await page.evaluate((s) => window.__DEFENSEGAME_E2E__?.api?.setSave(s), save);
  await page.reload({ waitUntil: "networkidle" });
  await waitForTown(page);
  await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.startNight());
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            window.__DEFENSEGAME_E2E__?.scene === "Defense" &&
            window.__DEFENSEGAME_E2E__?.ready === true,
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
}

/**
 * In-page bot, every 150ms: target the living enemy nearest the north wall.
 * Melee walks into it; ranged kites at 120–200px, stepping back north when
 * anything gets closer. Below 35% HP both back off toward the wall so the
 * auto-cast heals can land.
 */
async function startBot(page: Page, mode: Snapshot["mode"]): Promise<void> {
  await page.evaluate((attackMode) => {
    const w = window as unknown as { __winModelBot?: number };
    w.__winModelBot = window.setInterval(() => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      if (!api || window.__DEFENSEGAME_E2E__?.scene !== "Defense") return;
      if (api.getAttackMode() !== attackMode) api.setAttackMode(attackMode);
      const steer = (dx: number, dy: number) => {
        const d = Math.hypot(dx, dy);
        if (d < 1) api.clearStick();
        else void api.setStick(dx / d, dy / d);
      };
      const enemies = api.getLivingEnemyPositions();
      const me = api.getPlayerPosition();
      if (!enemies.length) {
        if (Math.hypot(me.x, me.y) < 30) api.clearStick();
        else steer(-me.x, -me.y);
        return;
      }
      let target = enemies[0]!;
      let nearest = enemies[0]!;
      const dist = (e: { x: number; y: number }) =>
        Math.hypot(e.x - me.x, e.y - me.y);
      for (const e of enemies) {
        if (e.y < target.y) target = e;
        if (dist(e) < dist(nearest)) nearest = e;
      }
      const hpFrac = api.getPlayerHp() / Math.max(1, api.getSave()?.player.hpMax ?? 100);
      if (hpFrac < 0.35 && dist(nearest) < 160) {
        steer(me.x - nearest.x, me.y - nearest.y - 60);
        return;
      }
      if (attackMode === "melee") {
        if (dist(target) < 40) api.clearStick();
        else steer(target.x - me.x, target.y - me.y);
        return;
      }
      if (dist(nearest) < 120) steer(me.x - nearest.x, me.y - nearest.y - 40);
      else if (dist(target) > 200) steer(target.x - me.x, target.y - me.y);
      else api.clearStick();
    }, 150);
  }, mode);
}

test.describe("win model validation @manual", () => {
  test.describe.configure({ mode: "parallel" });
  test.skip(snapshots.length === 0, `no snapshots at ${snapshotFile}`);

  for (const snap of snapshots) {
    for (let rep = 1; rep <= repeats; rep++) {
      test(`${snap.id} #${rep}`, async ({ page }) => {
        test.setTimeout(8 * 60_000);
        const start = Date.now();
        await bootCampaignNight(page, snap.save);
        await startBot(page, snap.mode);
        // Sample once a second until the night ends and Town is back.
        let last = { wall: 0, hp: 0, enemies: 0 };
        const trace: number[][] = [];
        const deadline = Date.now() + 7 * 60_000;
        for (;;) {
          const st = await page.evaluate(() => {
            const g = window.__DEFENSEGAME_E2E__;
            const api = g?.api;
            return {
              scene: g?.scene,
              wall: api?.getDefenseWallHp() ?? 0,
              hp: api?.getPlayerHp() ?? 0,
              enemies: api?.getEnemyCount() ?? 0,
            };
          });
          if (st.scene === "Town") break;
          last = st;
          trace.push([st.enemies, st.wall, st.hp]);
          expect(Date.now()).toBeLessThan(deadline);
          await page.waitForTimeout(1000);
        }
        const after = await page.evaluate(
          () => window.__DEFENSEGAME_E2E__?.api?.getSave() ?? null,
        );
        const won = (after?.night ?? 0) > snap.night;
        const row = {
          id: snap.id,
          night: snap.night,
          tier: snap.tier,
          mode: snap.mode,
          rep,
          predicted: snap.pressure.winChance,
          powerRatio: snap.pressure.powerRatio,
          won,
          lastWallHp: last.wall,
          lastPlayerHp: last.hp,
          lastEnemies: last.enemies,
          seconds: Math.round((Date.now() - start) / 1000),
          trace,
        };
        fs.appendFileSync(resultsFile, `${JSON.stringify(row)}\n`);
      });
    }
  }
});
