import { expect, type Page, test } from "@playwright/test";
import { gotoE2E } from "./helpers/game";
import { getTapTarget, tapCanvas, waitForTapTargets } from "./helpers/touch";

async function tapTarget(page: Page, id: string): Promise<void> {
  const pt = await getTapTarget(page, id);
  await tapCanvas(page, pt.x, pt.y);
}

function tapTargetIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {}),
  );
}

function savedTalents(page: Page) {
  return page.evaluate(() => {
    const save = window.__DEFENSEGAME_E2E__?.api?.getSave();
    return { ranks: save?.talents.ranks ?? {}, gold: save?.gold ?? -1 };
  });
}

test("talents: learn a rank from town, reset it for gold and close", async ({
  page,
}) => {
  await gotoE2E(page);
  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.setSave({
      gold: 500,
      talents: { ranks: {}, earned: 3 },
    });
  });
  await waitForTapTargets(page, ["town-talents"]);
  await tapTarget(page, "town-talents");
  await waitForTapTargets(page, [
    "talents-close",
    "talents-learn",
    "talents-node-sharpened_edge",
  ]);

  await tapTarget(page, "talents-node-sharpened_edge");
  await tapTarget(page, "talents-learn");
  await tapTarget(page, "talents-learn");
  await expect
    .poll(async () => (await savedTalents(page)).ranks)
    .toEqual({ sharpened_edge: 2 });

  // Reset is disabled (and has no tap target) until a point is spent.
  await waitForTapTargets(page, ["talents-reset"]);
  // Reset needs a confirm tap, then refunds every point for the gold cost.
  await tapTarget(page, "talents-reset");
  expect((await savedTalents(page)).ranks).toEqual({ sharpened_edge: 2 });
  await tapTarget(page, "talents-reset");
  await expect.poll(async () => (await savedTalents(page)).ranks).toEqual({});
  expect((await savedTalents(page)).gold).toBeLessThan(500);

  await tapTarget(page, "talents-close");
  await expect.poll(() => tapTargetIds(page)).not.toContain("talents-close");
  await expect.poll(() => tapTargetIds(page)).toContain("town-talents");
});
