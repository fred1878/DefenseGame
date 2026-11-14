import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";

async function apiEval(page: import("@playwright/test").Page, body: string) {
  return page.evaluate((code) => {
    const api = window.__DEFENSEGAME_E2E__?.api;
    if (!api) throw new Error("E2E api missing");
    // eslint-disable-next-line no-new-func
    return new Function("api", `return (${code})`)(api);
  }, body);
}

test.describe("golden paths", () => {
  test.beforeEach(async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
  });

  test("defense-movement", async ({ page }) => {
    const before = await page.evaluate(() => window.__DEFENSEGAME_E2E__?.player);
    expect(before).toBeTruthy();
    await apiEval(page, "api.setStick(1, 0, 600)");
    const after = await page.evaluate(() => window.__DEFENSEGAME_E2E__?.player);
    expect(after!.x).toBeGreaterThan(before!.x + 8);
  });

  test("defense-melee-fx", async ({ page }) => {
    await apiEval(page, "api.tapMelee()");
    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__DEFENSEGAME_E2E__?.flags.meleeFxSpawned),
        { timeout: 15_000 },
      )
      .toBe(1);
  });

  test("defense-ranged-projectile", async ({ page }) => {
    await apiEval(page, "api.tapRanged()");
    await expect
      .poll(async () => apiEval(page, "api.getProjectileCount()"), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    const stoneOk = await apiEval(
      page,
      "api.textureLoaded('fx_stone_throw')",
    );
    expect(stoneOk).toBe(true);
  });

  test("defense-fireball", async ({ page }) => {
    await apiEval(page, "api.castSpell(1)");
    await expect
      .poll(async () => apiEval(page, "api.getProjectileCount()"), {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);
    const fireOk = await apiEval(page, "api.textureLoaded('fx_fire_bolt')");
    expect(fireOk).toBe(true);
  });

  test("night-win", async ({ page }) => {
    const goldBefore = await apiEval(page, "api.getSave()?.gold ?? 0");
    const nightBefore = await apiEval(page, "api.getSave()?.night ?? 1");
    await apiEval(page, "api.setGodMode(true)");
    await apiEval(page, "api.forceWinNight()");
    await expect
      .poll(async () => apiEval(page, "api.getSave()?.night ?? 1"), {
        timeout: 15_000,
      })
      .toBe(nightBefore + 1);
    const goldAfter = await apiEval(page, "api.getSave()?.gold ?? 0");
    expect(goldAfter).toBeGreaterThan(goldBefore);
  });

  test("night-lose", async ({ page }) => {
    const goldBefore = await apiEval(page, "api.getSave()?.gold ?? 0");
    await apiEval(page, "api.damagePlayer(9999)");
    await expect
      .poll(async () => apiEval(page, "api.getSave()?.gold ?? 0"), {
        timeout: 15_000,
      })
      .toBeGreaterThan(goldBefore);
  });

  test("night-lose-retry-win", async ({ page }) => {
    const nightBefore = await apiEval(page, "api.getSave()?.night ?? 1");
    await apiEval(page, "api.damagePlayer(9999)");
    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__DEFENSEGAME_E2E__?.scene === "Town"),
        { timeout: 15_000 },
      )
      .toBe(true);
    await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.startNight());
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              window.__DEFENSEGAME_E2E__?.scene === "Defense" &&
              window.__DEFENSEGAME_E2E__?.ready === true,
          ),
        { timeout: 15_000 },
      )
      .toBe(true);
    await apiEval(page, "api.setGodMode(true)");
    await apiEval(page, "api.forceWinNight()");
    await expect
      .poll(async () => apiEval(page, "api.getSave()?.night ?? 1"), {
        timeout: 15_000,
      })
      .toBe(nightBefore + 1);
  });
});