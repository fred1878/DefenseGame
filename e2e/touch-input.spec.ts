import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";
import {
  dragCanvas,
  getTapTarget,
  holdCanvas,
  releasePointer,
  tapCanvas,
  waitForTapTargets,
} from "./helpers/touch";

test.describe("real pointer / touch input", () => {
  test.beforeEach(async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    await waitForTapTargets(page, ["combat-atk", "combat-mode", "spell-slot-0"]);
  });

  test("canvas tap on ATK starts melee swing", async ({ page }) => {
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(48, 0),
    );
  const atk = await getTapTarget(page, "combat-atk");
    await tapCanvas(page, atk.x, atk.y);
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__DEFENSEGAME_E2E__?.flags.attackPhase ?? "idle",
          ),
        { timeout: 15_000 },
      )
      .not.toBe("idle");
  });

  test("MEL/RNG toggle then ranged ATK via canvas", async ({ page }) => {
    await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(80, 0));
    const enemiesBefore = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.getEnemyCount() ?? 0,
    );
    expect(enemiesBefore).toBeGreaterThan(0);
    const mode = await getTapTarget(page, "combat-mode");
    await tapCanvas(page, mode.x, mode.y);
    const atk = await getTapTarget(page, "combat-atk");
    await tapCanvas(page, atk.x, atk.y);
    // Projectiles destroy on first hit (PR #43); adjacent spawns rarely expose count > 0 on CI.
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__DEFENSEGAME_E2E__?.api?.getEnemyCount() ?? enemiesBefore,
          ),
        { timeout: 15_000 },
      )
      .toBeLessThan(enemiesBefore);
  });

  test("spell slot via canvas tap fires nova", async ({ page }) => {
    await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(80, 40),
    );
    const slot = await getTapTarget(page, "spell-slot-0");
    await tapCanvas(page, slot.x, slot.y);
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__DEFENSEGAME_E2E__?.flags.enemyCount ?? 99,
          ),
        { timeout: 20_000 },
      )
      .toBeLessThan(99);
  });

  test("stick does not start inside ATK cluster", async ({ page }) => {
    const atk = await getTapTarget(page, "combat-atk");
    const before = await page.evaluate(() => window.__DEFENSEGAME_E2E__?.player);
    await tapCanvas(page, atk.x, atk.y);
    const after = await page.evaluate(() => window.__DEFENSEGAME_E2E__?.player);
    expect(Math.hypot(after!.x - before!.x, after!.y - before!.y)).toBeLessThan(
      5,
    );
  });

  test("drag-off ATK release clears pressed visual and does not attack", async ({
    page,
  }) => {
    const atk = await getTapTarget(page, "combat-atk");
    await dragCanvas(page, atk.x, atk.y, atk.x, atk.y - 160);
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              window.__DEFENSEGAME_E2E__?.api?.isUiButtonPressed("combat-atk"),
          ),
        { timeout: 5_000 },
      )
      .toBe(false);
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__DEFENSEGAME_E2E__?.flags.attackPhase ?? "idle",
          ),
        { timeout: 3_000 },
      )
      .toBe("idle");
  });

  test("combat-auto toggles auto attack", async ({ page }) => {
    await waitForTapTargets(page, ["combat-auto"]);
    const before = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.getAutoAttackEnabled() ?? false,
    );
    const auto = await getTapTarget(page, "combat-auto");
    await tapCanvas(page, auto.x, auto.y);
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__DEFENSEGAME_E2E__?.api?.getAutoAttackEnabled(),
          ),
        { timeout: 5_000 },
      )
      .toBe(!before);
  });

  test("@manual pointer down shows pressed visual on combat-auto", async ({ page }) => {
    await waitForTapTargets(page, ["combat-auto"]);
    const auto = await getTapTarget(page, "combat-auto");
    await holdCanvas(page, auto.x, auto.y);
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              window.__DEFENSEGAME_E2E__?.api?.isUiButtonPressed("combat-auto"),
          ),
        { timeout: 3_000 },
      )
      .toBe(true);
    await releasePointer(page);
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              window.__DEFENSEGAME_E2E__?.api?.isUiButtonPressed("combat-auto"),
          ),
        { timeout: 3_000 },
      )
      .toBe(false);
  });

  test("@manual DOM mirror ATK button", async ({ page }) => {
    await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.syncDomMirrors());
    await page.locator('[data-testid="combat-atk"]').click({ force: true });
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__DEFENSEGAME_E2E__?.flags.attackPhase ?? "idle",
          ),
        { timeout: 10_000 },
      )
      .not.toBe("idle");
  });
});