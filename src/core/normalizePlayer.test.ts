import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import {
  normalizePlayerConfig,
  type PlayerConfigInput,
} from "./normalizePlayer";

function shippedPlayer(): unknown {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "public/data/player.json"), "utf8"),
  );
}

describe("normalizePlayerConfig", () => {
  it("requires complete player.json", () => {
    expect(() => normalizePlayerConfig({})).toThrow(ConfigLoadError);
  });

  it("derives autoAttackMeleeRange from engage fields", () => {
    const cfg = normalizePlayerConfig(shippedPlayer() as PlayerConfigInput);
    expect(cfg.autoAttackMeleeRange).toBe(
      cfg.meleeStrikeRangeWu +
        cfg.meleeEngageTargetRadiusWu -
        cfg.meleeActivationSlackWu,
    );
  });

  it("clamps endless panel default concurrent", () => {
    const cfg = normalizePlayerConfig(shippedPlayer() as PlayerConfigInput);
    expect(cfg.endlessPanelDefaultConcurrent).toBeGreaterThan(0);
  });
});
