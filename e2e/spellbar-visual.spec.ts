import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";
import { expectViewportScreenshot } from "./helpers/visualSnapshot";

const SPELL_BAR_CLIP = { x: 8, y: 996, width: 220, height: 118 } as const;

/** Spell bar only — proves icons render (not rainbow 404/HTML garbage). */
test.describe("spell bar visual", () => {
  test("defense spell strip", async ({ page }, testInfo) => {
    await gotoE2E(page);
    await startDefense(page);
    await expectViewportScreenshot(page, testInfo, "defense-spellbar-strip.png", {
      clip: SPELL_BAR_CLIP,
      maxDiffPixelRatio: 0.06,
    });
  });
});