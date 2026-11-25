import { test, expect } from "@playwright/test";
import { gotoE2E } from "./helpers/game";
import { tapCanvas, waitForTapTargets } from "./helpers/touch";

test.describe("town spell panel tap toggle", () => {
  test("pool tap adds to first empty slot and tap again removes", async ({
    page,
  }) => {
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

    await waitForTapTargets(page, ["spell-sort-pool-heal"]);

    const healPool = await page.evaluate(() => {
      const t = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
      return t["spell-sort-pool-heal"]!;
    });

    await tapCanvas(page, healPool.x, healPool.y);

    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.__DEFENSEGAME_E2E__?.api?.getSpellSortBarSlots(),
          ),
        { timeout: 5_000 },
      )
      .toEqual(expect.arrayContaining(["heal", "", "", "", "", "", "", ""]));

    const slotsAfterAdd = await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.getSpellSortBarSlots(),
    );
    expect(slotsAfterAdd?.[0]).toBe("heal");

    await tapCanvas(page, healPool.x, healPool.y);

    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.__DEFENSEGAME_E2E__?.api?.getSpellSortBarSlots(),
          ),
        { timeout: 5_000 },
      )
      .toEqual(["", "", "", "", "", "", "", ""]);
  });

  test("second tap adds spell to next free slot", async ({ page }) => {
    await gotoE2E(page);
    await page.evaluate(() => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      api?.setSave({
        spellBar: {
          slots: ["nova", "", "", "", "", "", "", ""],
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

    await waitForTapTargets(page, ["spell-sort-pool-heal"]);
    const healPool = await page.evaluate(() => {
      const t = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
      return t["spell-sort-pool-heal"]!;
    });

    await tapCanvas(page, healPool.x, healPool.y);

    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.__DEFENSEGAME_E2E__?.api?.getSpellSortBarSlots(),
          ),
        { timeout: 5_000 },
      )
      .toEqual(
        expect.arrayContaining(["nova", "heal", "", "", "", "", "", ""]),
      );
  });
});
