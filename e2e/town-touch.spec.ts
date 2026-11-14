import { test, expect } from "@playwright/test";
import { gotoE2E } from "./helpers/game";

test("start night via DOM mirror tap", async ({ page }) => {
  await gotoE2E(page);
  await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.syncDomMirrors());
  await page.locator('[data-testid="start-night"]').click({ force: true });
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            window.__DEFENSEGAME_E2E__?.scene === "Defense" &&
            window.__DEFENSEGAME_E2E__?.ready === true,
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
});