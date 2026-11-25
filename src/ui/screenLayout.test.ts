import { describe, expect, it } from "vitest";
import { GAME } from "../config";
import {
  combatChromeLayout,
  defensePlayAreaLayout,
  fpsDebugOverlayPosition,
  DEFENSE_BOTTOM_HUD_SHIFT_PX,
  DEFENSE_TOP_CHROME_TRIM_PX,
  hudBandHeight,
  hudTextPosition,
  nightReturnButtonPosition,
  spellBarCenterY,
  spellBarSlotOrigin,
  expectedSpellBarCenterY,
  townActionButtonY,
  townBuildingGridBandBottomFootY,
  townBuildingGridClearsStatus,
  townBuildingGridColumnX,
  townBuildingGridFootY,
  townFullscreenButtonPosition,
  townResetSaveButtonPosition,
  townStatusTextTopY,
  townTitleY,
} from "./screenLayout";
import { DEFENSE_SPELL_BAR } from "../config/spellBar";
import { defenseMinimapLayout } from "./defenseMinimap";
import { scaleUiX, scaleUiY } from "../core/displayScale";

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

  it("defensePlayAreaLayout sits between HUD bands", () => {
    const play = defensePlayAreaLayout(scene, safe);
    const chrome = combatChromeLayout(scene, safe);
    expect(play.y).toBe(play.topBandBottom);
    expect(play.topBandBottom).toBe(
      chrome.hudBand - DEFENSE_TOP_CHROME_TRIM_PX,
    );
    expect(play.y).toBeLessThan(chrome.hudBand);
    expect(play.y + play.height).toBe(chrome.bottomStrip.stripTop);
    expect(play.bottomBandTop).toBe(chrome.bottomStrip.stripTop);
    expect(play.height).toBe(chrome.bottomStrip.stripTop - play.topBandBottom);
    expect(chrome.bottomStrip.stripBottom).toBe(
      GAME.height + DEFENSE_BOTTOM_HUD_SHIFT_PX,
    );
    expect(play.width).toBe(GAME.width);
  });

  it("fps overlay clears defense minimap and town header buttons", () => {
    const defense = {
      ...mockScene(),
      scene: { key: "Defense" },
    } as Parameters<typeof fpsDebugOverlayPosition>[0];
    const mini = defenseMinimapLayout(defense, safe);
    const defensePos = fpsDebugOverlayPosition(defense, safe);
    expect(defensePos.y).toBeGreaterThanOrEqual(mini.y + mini.height);

    const town = {
      ...mockScene(),
      scene: { key: "Town" },
    } as Parameters<typeof fpsDebugOverlayPosition>[0];
    const townPos = fpsDebugOverlayPosition(town, safe);
    expect(townPos.y).toBeGreaterThanOrEqual(safe.top + scaleUiX(36));
    const reset = townResetSaveButtonPosition(
      town,
      safe,
      scaleUiX(118),
      scaleUiX(36),
    );
    const resetBottom = reset.y + scaleUiX(36) / 2;
    expect(townPos.y).toBeGreaterThan(resetBottom);
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
    expect(chrome.toggleW).toBeGreaterThan(0);
    expect(chrome.toggleH).toBeGreaterThan(chrome.toggleW);
  });

  it("spellBarCenterY aligns with bottom HUD strip", () => {
    const y = spellBarCenterY(scene, safe, 52);
    const chrome = combatChromeLayout(scene, safe);
    expect(y).toBe(chrome.bottomStrip.stripCenterY);
    expect(chrome.btnY).toBeGreaterThanOrEqual(chrome.bottomStrip.stripTop);
    expect(chrome.btnY).toBeLessThanOrEqual(chrome.bottomStrip.stripBottom);
    expect(chrome.autoY).toBe(chrome.modeY);
    expect(chrome.autoY).toBeLessThan(chrome.btnY);
    expect(chrome.autoX).toBeLessThan(chrome.modeX);
  });

  it("spell slots target bottom 15% of portrait canvas", () => {
    const chrome = combatChromeLayout(scene, safe);
    const { centerY, firstSlotCenterX } = spellBarSlotOrigin(
      scene,
      safe,
      DEFENSE_SPELL_BAR.slotCount,
      DEFENSE_SPELL_BAR.slotSizePx,
      DEFENSE_SPELL_BAR.slotGapPx,
    );
    expect(centerY).toBe(expectedSpellBarCenterY(scene, safe));
    const lastRowCenterY =
      centerY +
      (DEFENSE_SPELL_BAR.rowCount - 1) *
        (DEFENSE_SPELL_BAR.slotSizePx + DEFENSE_SPELL_BAR.rowGapPx);
    const gridBottom = lastRowCenterY + DEFENSE_SPELL_BAR.slotSizePx / 2;
    expect(gridBottom).toBeGreaterThan(GAME.height * 0.84);
    expect(gridBottom).toBeLessThanOrEqual(chrome.bottomStrip.stripBottom + 2);
    const lastCenterX =
      firstSlotCenterX +
      (DEFENSE_SPELL_BAR.columnCount - 1) *
        (DEFENSE_SPELL_BAR.slotSizePx + DEFENSE_SPELL_BAR.slotGapPx);
    const rowRight = lastCenterX + DEFENSE_SPELL_BAR.slotSizePx / 2;
    const rowEndMax = chrome.combatClusterLeft - scaleUiX(4);
    expect(rowRight).toBeLessThanOrEqual(rowEndMax + 0.5);
  });

  it("spell grid stays inside portrait viewport with tap padding", () => {
    const chrome = combatChromeLayout(scene, safe);
    const { firstSlotCenterX, centerY } = spellBarSlotOrigin(
      scene,
      safe,
      DEFENSE_SPELL_BAR.slotCount,
      DEFENSE_SPELL_BAR.slotSizePx,
      DEFENSE_SPELL_BAR.slotGapPx,
    );
    const half = DEFENSE_SPELL_BAR.slotSizePx / 2;
    const pad = DEFENSE_SPELL_BAR.tapPaddingPx;
    const margin = 6;
    const slot0Left = firstSlotCenterX - half - pad;
    expect(slot0Left).toBeGreaterThanOrEqual(margin);
    const lastColCenterX =
      firstSlotCenterX +
      (DEFENSE_SPELL_BAR.columnCount - 1) *
        (DEFENSE_SPELL_BAR.slotSizePx + DEFENSE_SPELL_BAR.slotGapPx);
    const rowRight = lastColCenterX + half + pad;
    expect(rowRight).toBeLessThanOrEqual(GAME.width - margin);

    const lastRowCenterY =
      centerY +
      (DEFENSE_SPELL_BAR.rowCount - 1) *
        (DEFENSE_SPELL_BAR.slotSizePx + DEFENSE_SPELL_BAR.rowGapPx);
    const gridBottom = lastRowCenterY + half + pad;
    expect(gridBottom).toBeLessThanOrEqual(chrome.bottomStrip.stripBottom + 1);
    const gridTop = centerY - half - pad;
    expect(gridTop).toBeGreaterThanOrEqual(margin);
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

  it("town chrome buttons sit flush to top corners with safe insets only", () => {
    const fsW = scaleUiX(168);
    const fsH = scaleUiX(36);
    const resetW = scaleUiX(118);
    const fs = townFullscreenButtonPosition(scene, safe, fsW, fsH);
    const reset = townResetSaveButtonPosition(scene, safe, resetW, fsH);
    expect(fs.x - fsW / 2).toBeCloseTo(safe.left, 0);
    expect(fs.y - fsH / 2).toBeCloseTo(safe.top, 0);
    expect(reset.x + resetW / 2).toBeCloseTo(GAME.width - safe.right, 0);
    expect(reset.y - fsH / 2).toBeCloseTo(safe.top, 0);
    expect(townStatusTextTopY()).toBeGreaterThan(townTitleY());
    expect(townStatusTextTopY()).toBeLessThan(scaleUiY(128));
  });

  it("town building grid fills band between status and bottom", () => {
    expect(townBuildingGridFootY(0)).toBe(townBuildingGridBandBottomFootY());
    expect(townBuildingGridFootY(3)).toBeLessThan(townBuildingGridFootY(2));
    expect(townBuildingGridFootY(2)).toBeLessThan(townBuildingGridFootY(1));
    expect(townBuildingGridFootY(1)).toBeLessThan(townBuildingGridFootY(0));
    expect(townBuildingGridColumnX(0)).toBeLessThan(GAME.width / 2);
    expect(townBuildingGridColumnX(1)).toBeGreaterThan(GAME.width / 2);
    expect(townBuildingGridClearsStatus(3, 112)).toBe(true);
    const mid = (townBuildingGridFootY(0) + townBuildingGridFootY(3)) / 2;
    expect(mid).toBeGreaterThan(GAME.height * 0.45);
  });
});
