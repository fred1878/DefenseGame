import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";
import {
  dragCanvas,
  getTapTarget,
  tapCanvas,
  tapGameButton,
  waitForTapTargets,
} from "./helpers/touch";

test("drag-off Start night clears pressed visual and stays in Town", async ({
  page,
}) => {
  await gotoE2E(page);
  await waitForTapTargets(page, ["start-night"]);
  const start = await getTapTarget(page, "start-night");
  await dragCanvas(page, start.x, start.y, start.x, start.y - 200);
  await expect
    .poll(
      async () =>
        page.evaluate(() =>
          window.__DEFENSEGAME_E2E__?.api?.isUiButtonPressed("start-night"),
        ),
      { timeout: 5_000 },
    )
    .toBe(false);
  await expect
    .poll(
      async () =>
        page.evaluate(() => window.__DEFENSEGAME_E2E__?.scene === "Town"),
      { timeout: 3_000 },
    )
    .toBe(true);
});

test("Haunted Well opens endless after campaign night when panel was left open", async ({
  page,
}) => {
  await gotoE2E(page);
  await page.evaluate(() =>
    window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
  );
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen() ?? false,
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  // The endless panel is deliberately left open here, and it (correctly) covers the
  // start-night building, so this one setup step uses the API.
  await startDefense(page, { via: "api" });
  await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.forceWinNight());
  await expect
    .poll(
      async () =>
        page.evaluate(() => window.__DEFENSEGAME_E2E__?.scene === "Town"),
      { timeout: 15_000 },
    )
    .toBe(true);
  const target = await getTapTarget(
    page,
    "town-building-town_special_haunted_well",
  );
  await tapCanvas(page, target.x, target.y);
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            window.__DEFENSEGAME_E2E__?.scene === "Town" &&
            (window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen() ?? false),
        ),
      { timeout: 5_000 },
    )
    .toBe(true);
});

test("Haunted Well reopens endless panel after close and campaign night", async ({
  page,
}) => {
  await gotoE2E(page);
  await page.evaluate(() =>
    window.__DEFENSEGAME_E2E__?.api?.openEndlessPanel(),
  );
  await waitForTapTargets(page, ["endless-close"]);
  const close = await getTapTarget(page, "endless-close");
  await tapCanvas(page, close.x, close.y);
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            !(window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen() ?? true),
        ),
      { timeout: 5_000 },
    )
    .toBe(true);
  await startDefense(page);
  await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.forceWinNight());
  await expect
    .poll(
      async () =>
        page.evaluate(() => window.__DEFENSEGAME_E2E__?.scene === "Town"),
      { timeout: 15_000 },
    )
    .toBe(true);
  const target = await getTapTarget(
    page,
    "town-building-town_special_haunted_well",
  );
  await tapCanvas(page, target.x, target.y);
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen() ?? false,
        ),
      { timeout: 5_000 },
    )
    .toBe(true);
});

test("Haunted Well opens endless panel without leaving Town", async ({
  page,
}) => {
  await gotoE2E(page);
  const target = await getTapTarget(
    page,
    "town-building-town_special_haunted_well",
  );
  await tapCanvas(page, target.x, target.y);
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            window.__DEFENSEGAME_E2E__?.scene === "Town" &&
            (window.__DEFENSEGAME_E2E__?.api?.isEndlessPanelOpen() ?? false),
        ),
      { timeout: 5_000 },
    )
    .toBe(true);
});

test("@manual touch debug overlays town interactive hit rects", async ({
  page,
}) => {
  await gotoE2E(page);
  await page.evaluate(() => {
    window.__DEFENSEGAME_E2E__?.api?.setShowTouchInput(true);
  });
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            window.__DEFENSEGAME_E2E__?.api?.getTownTouchDebugRectCount() ?? 0,
        ),
      { timeout: 5_000 },
    )
    .toBeGreaterThanOrEqual(8);
});

test("start night via a real canvas tap on Gallows Square", async ({
  page,
}) => {
  await gotoE2E(page);
  await tapGameButton(page, "start-night");
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
