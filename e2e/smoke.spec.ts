import { test, expect } from "@playwright/test";
import { COMBAT_FX_TEXTURE } from "../src/content/assets";
import { e2eApi, gotoE2E, startDefense } from "./helpers/game";

test.describe("smoke", () => {
  test("smoke-boot-town", async ({ page }) => {
    await gotoE2E(page);
    const scene = await page.evaluate(() => window.__DEFENSEGAME_E2E__?.scene);
    expect(scene).toBe("Town");
    await expect(page.locator("#game")).toBeVisible();
  });

  test("smoke-assets", async ({ page }) => {
    await gotoE2E(page);
    const assetsLoaded = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.assetsLoaded === true,
    );
    expect(assetsLoaded).toBe(true);
    const keys = [
      COMBAT_FX_TEXTURE.fireBolt,
      COMBAT_FX_TEXTURE.stoneThrow,
      COMBAT_FX_TEXTURE.playerMelee,
    ];
    for (const key of keys) {
      const ok = await e2eApi(page).eval<boolean>(
        `api.textureLoaded(${JSON.stringify(key)})`,
      );
      expect(ok).toBe(true);
    }
  });

  test("smoke-enter-defense", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    const player = await page.evaluate(() => window.__DEFENSEGAME_E2E__?.player);
    expect(player).not.toBeNull();
  });
});