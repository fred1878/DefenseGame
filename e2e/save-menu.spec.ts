import { expect, type Page, test } from "@playwright/test";
import { gotoE2E } from "./helpers/game";
import { getTapTarget, tapCanvas, waitForTapTargets } from "./helpers/touch";

const STALL = "town-building-town_market_stall_daylit";

function tapTargetIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {}),
  );
}

async function tapTarget(page: Page, id: string): Promise<void> {
  const pt = await getTapTarget(page, id);
  await tapCanvas(page, pt.x, pt.y);
}

test("save menu: open from the daylit stall, close, and reopen", async ({
  page,
}) => {
  await gotoE2E(page);
  await waitForTapTargets(page, [STALL]);
  await tapTarget(page, STALL);
  await waitForTapTargets(page, ["save-menu-close", "save-menu-save"]);

  await tapTarget(page, "save-menu-close");
  await expect.poll(() => tapTargetIds(page)).not.toContain("save-menu-close");
  expect(await page.evaluate(() => window.__DEFENSEGAME_E2E__?.scene)).toBe(
    "Town",
  );

  await tapTarget(page, STALL);
  await waitForTapTargets(page, ["save-menu-close", "save-menu-slot-0"]);
  const ids = await tapTargetIds(page);
  expect(ids).toContain("save-menu-slot-4");
  expect(ids).not.toContain("save-menu-confirm");
});
