import { describe, expect, it } from "vitest";
import {
  ENDLESS_PANEL_DEFAULT_CONCURRENT,
  PLAYER_TUNING_DEFAULTS,
} from "../config/player";
import { normalizePlayerConfig } from "./normalizePlayer";

describe("normalizePlayerConfig", () => {
  it("fills defaults when file is empty", () => {
    const cfg = normalizePlayerConfig({});
    expect(cfg.moveSpeed).toBe(PLAYER_TUNING_DEFAULTS.moveSpeed);
    expect(cfg.endlessPanelDefaultConcurrent).toBe(
      ENDLESS_PANEL_DEFAULT_CONCURRENT,
    );
  });

  it("recomputes autoAttackMeleeRange when strike range overrides", () => {
    const cfg = normalizePlayerConfig({ meleeStrikeRange: 100 });
    expect(cfg.autoAttackMeleeRange).toBe(100 + 14 - 6);
  });

  it("clamps endless panel default concurrent", () => {
    expect(
      normalizePlayerConfig({ endlessPanelDefaultConcurrent: 200 })
        .endlessPanelDefaultConcurrent,
    ).toBe(99);
  });
});