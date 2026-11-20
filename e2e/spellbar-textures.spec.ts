import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense, e2eApi } from "./helpers/game";

/** Runtime proof spell hotbar textures match committed 64×64 PNGs (not 404 HTML garbage). */
test.describe("@manual spell bar textures", () => {
  test.beforeEach(async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
  });

  test("defense slots load spell_icon_* at 64×64 nearest", async ({ page }) => {
    const audit = await e2eApi(page).eval<
      Array<{
        slot: number;
        spellId: string;
        key: string;
        loaded: boolean;
        width: number;
        height: number;
      }>
    >(`api.auditSpellBarTextures()`);

    expect(audit.length).toBe(8);
    const filled = audit.filter((r) => r.spellId);
    expect(filled.length).toBeGreaterThanOrEqual(4);

    for (const row of filled) {
      expect(row.loaded, `texture ${row.key}`).toBe(true);
      expect(row.width, `${row.key} width`).toBe(64);
      expect(row.height, `${row.key} height`).toBe(64);
    }
  });
});