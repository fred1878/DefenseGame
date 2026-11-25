import { test, expect } from "@playwright/test";
import {
  closeDefenseBootHandle,
  newDefenseBootedPage,
  waitCombatAttackIdle,
  type DefenseBootHandle,
} from "./helpers/hooks";

test.describe("combat without cheats", () => {
  test.describe.configure({ mode: "serial" });

  let boot: DefenseBootHandle;

  test.beforeAll(async ({ browser }) => {
    boot = await newDefenseBootedPage(browser);
  });

  test.afterAll(async () => {
    await closeDefenseBootHandle(boot);
  });

  test("melee kills spawned enemy", async () => {
    const page = boot.page;
    await page.evaluate(() => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      api?.spawnTestEnemy(42, 0);
    });
    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__DEFENSEGAME_E2E__?.flags.enemyCount),
        { timeout: 5_000 },
      )
      .toBe(1);

    await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.tapMelee());
    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__DEFENSEGAME_E2E__?.flags.enemyCount),
        { timeout: 20_000 },
      )
      .toBe(0);
  });

  test("ranged projectile reduces enemy count", async () => {
    const page = boot.page;
    await waitCombatAttackIdle(page);
    await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(80, 0));
    await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.tapRanged());
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__DEFENSEGAME_E2E__?.api?.getProjectileCount() ?? 0,
          ),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__DEFENSEGAME_E2E__?.flags.enemyCount),
        { timeout: 25_000 },
      )
      .toBe(0);
  });

  test("enemy at wall reduces defense wall hp", async () => {
    const page = boot.page;
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(0, -520),
    );
    const wallBefore = await page.evaluate(
      () => Number(window.__DEFENSEGAME_E2E__?.flags.defenseWallHp ?? 999),
    );
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__DEFENSEGAME_E2E__?.api?.getDefenseWallHp() ?? 999,
          ),
        { timeout: 25_000 },
      )
      .toBeLessThan(wallBefore);
  });
});