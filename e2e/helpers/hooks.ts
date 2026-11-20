import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { gotoE2E, startDefense } from "./game";

/** Match `playwright.config.ts` game viewport (chromium project). */
export const E2E_VIEWPORT = { width: 540, height: 1200 } as const;

export type DefenseBootHandle = {
  page: Page;
  context: BrowserContext;
};

export async function newDefenseBootedPage(
  browser: Browser,
  options?: { afterBoot?: (page: Page) => Promise<void> },
): Promise<DefenseBootHandle> {
  const context = await browser.newContext({
    viewport: E2E_VIEWPORT,
    hasTouch: true,
  });
  const page = await context.newPage();
  await gotoE2E(page);
  await startDefense(page);
  if (options?.afterBoot) {
    await options.afterBoot(page);
  }
  return { page, context };
}

export async function closeDefenseBootHandle(
  handle: DefenseBootHandle | undefined,
): Promise<void> {
  await handle?.context.close();
}

/** Serial shared-defense specs: melee tests can leave attack wind-up / cooldown active. */
export async function waitCombatAttackIdle(
  page: Page,
  timeoutMs = 20_000,
): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => window.__DEFENSEGAME_E2E__?.flags.attackPhase ?? "idle",
        ),
      { timeout: timeoutMs },
    )
    .toBe("idle");
}