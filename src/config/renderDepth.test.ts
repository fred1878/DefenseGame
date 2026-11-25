import { describe, expect, it } from "vitest";
import { DEFENSE_RENDER_DEPTH } from "./renderDepth";

describe("DEFENSE_RENDER_DEPTH", () => {
  it("draws obstacle cosmetic art above player and enemy sprites", () => {
    expect(DEFENSE_RENDER_DEPTH.obstacleRock).toBeGreaterThan(
      DEFENSE_RENDER_DEPTH.enemy,
    );
    expect(DEFENSE_RENDER_DEPTH.enemy).toBeGreaterThan(
      DEFENSE_RENDER_DEPTH.player,
    );
    expect(DEFENSE_RENDER_DEPTH.obstacleRock).toBeLessThan(
      DEFENSE_RENDER_DEPTH.projectile,
    );
  });
});
