import { type Page, expect } from "@playwright/test";
import { tapGameButton } from "./touch";

export async function gotoE2E(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem("defensegame-e2e-save");
    for (let i = 0; i < 5; i++) {
      localStorage.removeItem(`defensegame-e2e-save-slot-${i}`);
    }
  });
  await page.goto("/?e2e=1", { waitUntil: "networkidle" });
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const s = window.__DEFENSEGAME_E2E__;
          return s?.ready === true && s.scene === "Town";
        }),
      { timeout: 45_000 },
    )
    .toBe(true);
  await expect
    .poll(
      async () =>
        page.evaluate(() => window.__DEFENSEGAME_E2E__?.assetsLoaded === true),
      { timeout: 60_000 },
    )
    .toBe(true);
}

/**
 * Enter Defense from Town. Default: tap the real "start night" building on the canvas
 * (Gallows Square). `via: "api"` calls the e2e API instead; only for setups where an
 * open overlay is part of the test and would (correctly) swallow the tap.
 */
export async function startDefense(
  page: Page,
  { via = "tap" }: { via?: "tap" | "api" } = {},
): Promise<void> {
  if (via === "tap") {
    await tapGameButton(page, "start-night");
  } else {
    await page.evaluate(() => window.__DEFENSEGAME_E2E__?.api?.startNight());
  }
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

export function e2eApi(page: Page) {
  return {
    eval<T>(fn: string, arg?: unknown): Promise<T> {
      return page.evaluate(
        ({ body, value }) => {
          const api = window.__DEFENSEGAME_E2E__?.api;
          if (!api) throw new Error("E2E api missing");
          // eslint-disable-next-line no-new-func
          const runner = new Function("api", "arg", `return (${body})`);
          return runner(api, value) as T;
        },
        { body: fn, value: arg },
      );
    },
  };
}
