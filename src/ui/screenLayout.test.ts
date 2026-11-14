import { describe, expect, it } from "vitest";
import { GAME } from "../config";
import {
  combatChromeLayout,
  hudBandHeight,
  hudTextPosition,
  nightReturnButtonPosition,
  spellBarCenterY,
  spellBarSlotOrigin,
  expectedSpellBarCenterY,
  townActionButtonY,
} from "./screenLayout";
import { SPELL_BAR } from "../config/spells";

function mockScene(
  width = GAME.width,
  height = GAME.height,
): Parameters<typeof combatChromeLayout>[0] {
  return { scale: { width, height } } as Parameters<
    typeof combatChromeLayout
  >[0];
}

describe("screenLayout", () => {
  const scene = mockScene();
  const safe = { top: 0, right: 0, bottom: 0, left: 0 };

  it("hudBandHeight grows with safe top", () => {
    expect(hudBandHeight(20)).toBeGreaterThan(hudBandHeight(0));
  });

  it("hudTextPosition respects safe insets", () => {
    const pos = hudTextPosition({ top: 10, left: 8, right: 0, bottom: 0 });
    expect(pos.y).toBeGreaterThan(hudTextPosition(safe).y);
    expect(pos.x).toBeGreaterThan(hudTextPosition(safe).x);
  });

  it("combatChromeLayout places ATK above bottom margin", () => {
    const chrome = combatChromeLayout(scene, safe);
    expect(chrome.atkX).toBeLessThan(GAME.width);
    expect(chrome.btnY).toBeLessThan(GAME.height);
    expect(chrome.hudBand).toBe(hudBandHeight(0));
  });

  it("spellBarCenterY aligns with bottom HUD strip", () => {
    const y = spellBarCenterY(scene, safe, 52);
    const chrome = combatChromeLayout(scene, safe);
    expect(y).toBe(chrome.bottomStrip.stripCenterY);
    expect(chrome.btnY).toBe(chrome.bottomStrip.stripCenterY);
    expect(chrome.modeY).toBe(chrome.autoY);
  });

  it("spell slots target bottom 15% of portrait canvas", () => {
    const { centerY } = spellBarSlotOrigin(
      scene,
      safe,
      SPELL_BAR.slotCount,
      SPELL_BAR.slotSizePx,
      SPELL_BAR.slotGapPx,
    );
    expect(centerY).toBe(expectedSpellBarCenterY(scene, safe));
    expect(centerY).toBeGreaterThan(GAME.height * 0.85);
    expect(centerY).toBeGreaterThan(1000);
  });

  it("nightReturnButtonPosition is below HUD band", () => {
    const btn = nightReturnButtonPosition(scene, safe);
    expect(btn.y).toBeGreaterThan(hudBandHeight(0));
    expect(btn.x + btn.width / 2).toBeLessThanOrEqual(GAME.width);
  });

  it("townActionButtonY stacks from bottom", () => {
    const y0 = townActionButtonY(scene, safe, 0);
    const y1 = townActionButtonY(scene, safe, 1);
    expect(y0).toBeGreaterThan(y1);
    expect(y0).toBeLessThan(GAME.height);
  });
});