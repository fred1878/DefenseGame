import { describe, expect, it } from "vitest";
import { GAME } from "../config";
import { DEFENSE_SPELL_BAR } from "../config/spellBar";
import {
  buildCombatStickUiMask,
  combatChromeLayout,
  combatDebugButtonPosition,
  spellBarSlotCenter,
} from "./defenseHudLayout";
import { debugButtonPosition } from "./townHudLayout";

function mockScene(width = GAME.width, height = GAME.height): Phaser.Scene {
  return { scale: { width, height } } as Phaser.Scene;
}

describe("hud layout positions", () => {
  const safe = { top: 0, right: 0, bottom: 0, left: 0 };
  const scene = mockScene();

  it("places the town debug button in the bottom-left", () => {
    const pos = debugButtonPosition(scene, safe);
    expect(pos.x).toBeGreaterThan(0);
    expect(pos.x).toBeLessThan(GAME.width / 2);
    expect(pos.y).toBeGreaterThan(GAME.height / 2);
  });

  it("places the combat debug button from chrome", () => {
    const chrome = combatChromeLayout(scene, safe);
    const pos = combatDebugButtonPosition(scene, safe);
    expect(pos).toEqual({ x: chrome.debugX, y: chrome.debugY });
  });

  it("spaces spell bar slots across the grid", () => {
    const a = spellBarSlotCenter(scene, safe, 0, 48, 8, 8);
    const b = spellBarSlotCenter(scene, safe, 1, 48, 8, 8);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBe(a.y);
    const nextRow = spellBarSlotCenter(
      scene,
      safe,
      DEFENSE_SPELL_BAR.columnCount,
      48,
      8,
      8,
    );
    expect(nextRow.x).toBe(a.x);
    expect(nextRow.y).toBeGreaterThan(a.y);
  });

  it("masks the HUD band, bottom strip, and debug button", () => {
    const chrome = combatChromeLayout(scene, safe);
    const debug = {
      getBounds: () => ({ x: 400, y: 40, width: 40, height: 40 }),
    } as unknown as Phaser.GameObjects.Container;
    const mask = buildCombatStickUiMask(
      scene,
      chrome,
      { x: 0, y: 0, width: 10, height: 10 },
      debug,
    );
    expect(mask.length).toBe(3);
    expect(mask[0]?.height).toBe(chrome.hudBand);
    expect(mask[1]?.y).toBeLessThanOrEqual(chrome.bottomStrip.stripTop);
  });
});
