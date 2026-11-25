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
    // Auto attack is on by default and would fire on its own (and keep the
    // attack phase busy), so turn it off: only the ATK tap may hit.
    await waitForTapTargets(page, ["combat-auto"]);
    const auto = await getTapTarget(page, "combat-auto");
    await tapCanvas(page, auto.x, auto.y);
    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__DEFENSEGAME_E2E__?.api?.getAutoAttackEnabled(),
          ),
        { timeout: 15_000 },
      )
      .toBe(false);

    // God mode keeps the night running: if the enemy killed the player the
    // scene would leave Defense and the HP list would read as empty.
    await page.evaluate(() => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      api?.setGodMode(true);
      api?.spawnTestEnemy(80, 0);
    });
    const hpBefore = await page.evaluate(() =>
      (window.__DEFENSEGAME_E2E__?.api?.getLivingEnemyHps() ?? []).reduce(
        (a, b) => a + b,
        0,
      ),
    );
    expect(hpBefore).toBeGreaterThan(0);

    // Wait until the toggle has landed in game state and the player is idle;
    // on a loaded CI runner the tap is applied a few frames later, and an ATK
    // tap before that resolves as melee.
    const mode = await getTapTarget(page, "combat-mode");
    await tapCanvas(page, mode.x, mode.y);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const api = window.__DEFENSEGAME_E2E__?.api;
            return `${api?.getAttackMode()}:${api?.getAttackPhase()}`;
          }),
        { timeout: 15_000 },
      )
      .toBe("ranged:idle");

    const atk = await getTapTarget(page, "combat-atk");
    await tapCanvas(page, atk.x, atk.y);
    // Assert damage, not a kill: total enemy HP must drop (0 if it died).
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const s = window.__DEFENSEGAME_E2E__;
            if (s?.scene !== "Defense") return Number.POSITIVE_INFINITY;
            return (s.api?.getLivingEnemyHps() ?? []).reduce((a, b) => a + b, 0);
          }),
        { timeout: 20_000 },
      )
      .toBeLessThan(hpBefore);
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