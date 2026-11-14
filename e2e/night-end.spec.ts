import { test, expect } from "@playwright/test";
import { getTapTarget, tapCanvas, waitForTapTargets } from "./helpers/touch";

async function gotoManualReturn(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.removeItem("defensegame-e2e-save");
  });
  await page.goto("/?e2e=1&manualReturn=1", { waitUntil: "networkidle" });
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            window.__DEFENSEGAME_E2E__?.ready === true &&
            window.__DEFENSEGAME_E2E__?.scene === "Town",
        ),
      { timeout: 45_000 },
    )
    .toBe(true);
  await page.evaluate(() => {
    const api = window.__DEFENSEGAME_E2E__?.api;
    api?.setSave({ night: 9999 });
    api?.startNight();
  });
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
}

test.describe("night end UX", () => {
  test("return button appears and combat stops until tapped", async ({
    page,
  }) => {
    await gotoManualReturn(page);
    await page.evaluate(() => {
      const api = window.__DEFENSEGAME_E2E__?.api;
      api?.setManualReturnToTown(true);
      api?.setSpawnPlanComplete();
      api?.forceWinNight();
    });

    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__DEFENSEGAME_E2E__?.api?.nightEnded() === true,
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__DEFENSEGAME_E2E__?.api?.hasReturnButton() === true,
          ),
        { timeout: 5_000 },
      )
      .toBe(true);

    expect(
      await page.evaluate(() => window.__DEFENSEGAME_E2E__?.scene),
    ).toBe("Defense");

    await waitForTapTargets(page, ["defense-return-to-town"]);
    const ret = await getTapTarget(page, "defense-return-to-town");
    await tapCanvas(page, ret.x, ret.y);

    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__DEFENSEGAME_E2E__?.scene === "Town"),
        { timeout: 15_000 },
      )
      .toBe(true);

    const night = await page.evaluate(
      () => window.__DEFENSEGAME_E2E__?.api?.getSave()?.night ?? 0,
    );
    expect(night).toBeGreaterThan(1);
  });
});