/**
 * Defense HUD geometry + asset checks (not full-page pixels).
 *
 * Visual regression pixels live in `e2e/visual.spec.ts`. CI runs Playwright with
 * `--project=chromium` only (`.github/workflows/ci.yml`). Run `mobile-chrome`
 * locally when checking DPR-scaled snapshots.
 */
import { test, expect } from "@playwright/test";
import { gotoE2E, startDefense } from "./helpers/game";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 1200;
const VIEWPORT_MARGIN = 8;
/** Defense spell slots use 2× tap padding; allow bleed at bottom safe edge. */
const TAP_HIT_BLEED = 6;

test.describe("defense HUD layout", () => {
  test("no bottom panel chrome, spell row left of MEL", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    await page.evaluate(async () => {
      await window.__DEFENSEGAME_E2E__?.api?.spawnTestEnemy(120, 0);
    });

    const chromeKey = await page.evaluate(() =>
      window.__DEFENSEGAME_E2E__?.api?.e2eBottomChromeTextureKey(),
    );
    expect(chromeKey).toBeNull();

    const { targets, stripCenterY, stripH, slotCount, hitRects } =
      await page.evaluate(() => {
        const hud = window.__HUD_DEBUG__ as
          | { stripCenterY: number; stripH: number }
          | undefined;
        const api = window.__DEFENSEGAME_E2E__?.api;
        const rects = api?.getSpellSlotHitRects() ?? [];
        return {
          targets: api?.getUiTapTargets() ?? {},
          stripCenterY: hud?.stripCenterY ?? 0,
          stripH: hud?.stripH ?? 0,
          slotCount: rects.length,
          hitRects: rects,
        };
      });

    expect(slotCount).toBe(8);
    expect(stripCenterY).toBeGreaterThan(900);
    const bandHalf = stripH / 2 + 48;

    for (let i = 0; i < slotCount; i++) {
      const key = `spell-slot-${i}`;
      const pt = targets[key];
      expect(pt, `missing ${key}`).toBeTruthy();
      expect(pt!.x).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
      expect(pt!.x).toBeLessThanOrEqual(GAME_WIDTH - VIEWPORT_MARGIN);
      expect(pt!.y).toBeGreaterThanOrEqual(stripCenterY - bandHalf - 20);
      expect(pt!.y).toBeLessThanOrEqual(stripCenterY + bandHalf + 20);

      const rect = hitRects.find((r) => r.index === i);
      expect(rect, `missing hit rect ${i}`).toBeTruthy();
      expect(rect!.x).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(
        GAME_WIDTH - VIEWPORT_MARGIN + 0.5,
      );
      expect(pt!.y).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
      expect(pt!.y).toBeLessThanOrEqual(GAME_HEIGHT - VIEWPORT_MARGIN);
      expect(rect!.y).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(
        GAME_HEIGHT - VIEWPORT_MARGIN + TAP_HIT_BLEED,
      );
    }

    const slot0 = hitRects.find((r) => r.index === 0);
    expect(slot0).toBeTruthy();
    expect(slot0!.x).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
    expect(slot0!.y).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);

    const overlap = await page.evaluate(() => {
      const targets = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
      const pad = 28;
      const rects = (id: string) => {
        const pt = targets[id];
        if (!pt) return null;
        return { x: pt.x - pad, y: pt.y - pad, w: pad * 2, h: pad * 2 };
      };
      const hits = (a: NonNullable<ReturnType<typeof rects>>, b: NonNullable<ReturnType<typeof rects>>) =>
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y;

      const spellLast = rects("spell-slot-7");
      const mel = rects("combat-mode");
      const spell0 = rects("spell-slot-0");
      const debug = rects("defense-debug");
      if (!spellLast || !mel || !spell0 || !debug) return null;
      return {
        spellMel: hits(spellLast, mel),
        debugSpell: hits(debug, spell0),
        spellLast,
        mel,
        spell0,
        debug,
      };
    });
    expect(overlap).not.toBeNull();
    expect(overlap!.spellMel, JSON.stringify(overlap)).toBe(false);
    expect(overlap!.debugSpell, JSON.stringify(overlap)).toBe(false);

  const combatOrder = await page.evaluate(() => {
    const t = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
    const auto = t["combat-auto"];
    const mel = t["combat-mode"];
    const atk = t["combat-atk"];
    if (!auto || !mel || !atk) return null;
    return { autoX: auto.x, melX: mel.x, atkX: atk.x, rowY: Math.round(mel.y) };
  });
  expect(combatOrder).not.toBeNull();
  expect(combatOrder!.autoX).toBeLessThan(combatOrder!.melX);
  expect(combatOrder!.melX).toBeLessThan(combatOrder!.atkX);
  expect(combatOrder!.rowY).toBeGreaterThan(900);
  });

  test("minimap frame is top-right below HUD", async ({ page }) => {
    await gotoE2E(page);
    await startDefense(page);
    const minimap = await page.evaluate(() => {
      const hud = window.__HUD_DEBUG__ as
        | { minimap?: { x: number; y: number; width: number; height: number } }
        | undefined;
      return hud?.minimap ?? null;
    });
    expect(minimap).not.toBeNull();
    expect(minimap!.width).toBeGreaterThan(0);
    expect(minimap!.x + minimap!.width).toBeLessThanOrEqual(GAME_WIDTH + 2);
    expect(minimap!.y).toBeGreaterThan(80);
    expect(minimap!.y).toBeLessThan(220);
  });
});