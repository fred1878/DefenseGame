import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";

test.describe("@manual performance hook", () => {
  test("samples fps in defense", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    const fps = await page.evaluate(async () => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      return api?.sampleFps(2) ?? 0;
    });
    expect(fps).toBeGreaterThan(5);
  });
});
