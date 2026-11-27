import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { SaveGame } from "../src/core/saveTypes";

/**
 * Real-fight harness (@manual, driven by `npm run sim:fights`, see
 * docs/ECONOMY_SIM.md): replays sim starting saves in the real game with the
 * campaign wave running (`campaignWaves=1`) and a simple bot (auto-attack,
 * auto-cast, potions and bombs). Results are appended as JSON lines for
 * comparison with the power model's predicted win chance.
 *
 * Env: WIN_MODEL_SNAPSHOTS (snapshots JSON), WIN_MODEL_RESULTS (output
 * .jsonl), WIN_MODEL_REPEATS (fights per snapshot), WIN_MODEL_DATA_DIR
 * (optional folder of data JSON files served instead of /data/<name>.json,
 * e.g. candidate waves), WIN_MODEL_FULL_CAST=1 (full-cast bot, below).
 */

type Snapshot = {
  id: string;
  night: number;
  tier: string;
  save: SaveGame;
  mode: "melee" | "ranged";
  strategy?: string;
};

const root = process.cwd();
const snapshotFile =
  process.env.WIN_MODEL_SNAPSHOTS ??
  path.join(root, "sim-output/win-model-snapshots.json");
const resultsFile =
  process.env.WIN_MODEL_RESULTS ??
  path.join(root, "sim-output/win-model-results.jsonl");
const snapshots: Snapshot[] = fs.existsSync(snapshotFile)
  ? (JSON.parse(fs.readFileSync(snapshotFile, "utf8")) as Snapshot[])
  : [];
const repeats = Number(process.env.WIN_MODEL_REPEATS ?? "1");
const dataDir = process.env.WIN_MODEL_DATA_DIR ?? "";
const fullCast = process.env.WIN_MODEL_FULL_CAST === "1";

/** Serve override data files (e.g. candidate waves.json) from `dataDir`. */
async function routeDataOverrides(page: Page): Promise<void> {
  if (!dataDir || !fs.existsSync(dataDir)) return;
  for (const file of fs.readdirSync(dataDir)) {
    if (!file.endsWith(".json")) continue;
    const body = fs.readFileSync(path.join(dataDir, file), "utf8");
    await page.route(`**/data/${file}*`, (route) =>
      route.fulfill({ body, contentType: "application/json" }),
    );
  }
}

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
  await routeDataOverrides(page);
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
  await page.evaluate(() =>
    window.__DEFENSEGAME_E2E__?.api?.resetCombatTally(),
  );
}

/**
 * In-page bot, every 150ms: target the living enemy nearest the north wall.
 * Melee walks into it; ranged kites at 120–200px, stepping back north when
 * anything gets closer. Below 35% HP both back off toward the wall. Heals
 * need the player still, so under 70% HP the bot stops while a heal on the
 * auto-cast bar is ready, and it never moves during a heal. Drinks a potion
 * (Q) under 45% HP and throws a bomb (E) when 5+ enemies are within 160px.
 *
 * Full-cast mode (WIN_MODEL_FULL_CAST=1) finishes every cast: while a windup
 * or channel is running the bot holds still (no step, no retreat, so nothing
 * interrupts it), and when an auto-cast windup spell is ready with an enemy
 * close enough to target (60px melee, 200px ranged) it stops so auto-cast
 * can start it.
 */
async function startBot(page: Page, mode: Snapshot["mode"]): Promise<void> {
  await page.evaluate(
    ({ attackMode, fullCast }) => {
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
        const hpFrac =
          api.getPlayerHp() / Math.max(1, api.getSave()?.player.hpMax ?? 100);
        const press = (key: string) =>
          window.dispatchEvent(new KeyboardEvent("keydown", { key }));
        if (hpFrac < 0.45) press("q");
        if (enemies.filter((e) => dist(e) < 160).length >= 5) press("e");
        const cast = api.getSpellCastState();
        const isHeal = (id: string | null) =>
          id === "heal" || id === "flash_heal";
        // Heals need the player still (windup / channel); stop for them
        // when hurt, and never walk out of one.
        if (
          isHeal(cast.activeSpellId) ||
          (hpFrac < 0.7 && cast.readyWindupSpellIds.some(isHeal))
        ) {
          api.clearStick();
          return;
        }
        if (fullCast) {
          if (cast.activeSpellId) {
            api.clearStick();
            return;
          }
          const reach = attackMode === "melee" ? 60 : 200;
          if (
            hpFrac >= 0.35 &&
            cast.readyWindupSpellIds.length > 0 &&
            dist(nearest) < reach
          ) {
            api.clearStick();
            return;
          }
        }
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
    },
    { attackMode: mode, fullCast },
  );
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
        const tally = await page.evaluate(
          () => window.__DEFENSEGAME_E2E__?.api?.getCombatTally() ?? {},
        );
        const cast = await page.evaluate(
          () =>
            window.__DEFENSEGAME_E2E__?.api?.getCastTally() ?? {
              casts: {},
              healed: 0,
            },
        );
        const won = (after?.night ?? 0) > snap.night;
        const row = {
          id: snap.id,
          night: snap.night,
          tier: snap.tier,
          mode: snap.mode,
          rep,
          won,
          lastWallHp: last.wall,
          lastPlayerHp: last.hp,
          lastEnemies: last.enemies,
          tally,
          casts: cast.casts,
          healed: Math.round(cast.healed),
          bar: snap.save.spellBar.slots.filter(Boolean),
          strategy: snap.strategy ?? "balanced",
          bot: fullCast ? "full-cast" : "default",
          seconds: Math.round((Date.now() - start) / 1000),
          trace,
        };
        fs.appendFileSync(resultsFile, `${JSON.stringify(row)}\n`);
      });
    }
  }
});
