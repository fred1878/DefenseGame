import { test, expect } from "@playwright/test";
import { gotoE2E } from "./helpers/game";
import { dragCanvas, waitForTapTargets } from "./helpers/touch";

test.describe("@manual town spell panel drag", () => {
  test("drag castable spell from pool onto bar slot", async ({ page }) => {
    await gotoE2E(page);
    await page.evaluate(() => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      api?.setSave({
        spellBar: {
          slots: ["", "", "", "", "", "", "", ""],
          autoCastSpellIds: [],
        },
      });
      api?.openSpellSortPanel();
    });
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(window.__DEFENSEGAME_E2E__?.api?.isSpellSortPanelOpen()),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    await waitForTapTargets(page, [
      "spell-sort-slot-0",
      "spell-sort-pool-heal",
    ]);

    const from = await page.evaluate(() => {
      const t = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
      return t["spell-sort-pool-heal"]!;
    });
    const to = await page.evaluate(() => {
      const t = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
      return t["spell-sort-slot-0"]!;
    });

    await dragCanvas(page, from.x, from.y, to.x, to.y);

    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.__DEFENSEGAME_E2E__?.api?.getSpellSortBarSlots(),
          ),
        { timeout: 5_000 },
      )
      .toEqual(expect.arrayContaining(["heal"]));

    const slots = await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.getSpellSortBarSlots(),
    );
    expect(slots?.[0]).toBe("heal");
  });
});
