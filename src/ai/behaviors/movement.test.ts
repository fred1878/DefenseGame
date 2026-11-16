import { describe, expect, it, vi } from "vitest";
import { northWallAttackY } from "../../config";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import {
  applyChaseVelocity,
  applyWallMeleeHold,
  shouldHoldAtWallMelee,
  wallMeleeStandoffY,
} from "./movement";

describe("wall melee hold helpers", () => {
  it("holds when idle on wall cooldown inside trigger range", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      sprite: {
        x: 40,
        y: 0,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    });
    enemy.sprite.y = wallMeleeStandoffY(enemy);
    enemy.combat.phase = "idle";
    enemy.combat.cooldownMs = 400;
    expect(shouldHoldAtWallMelee(enemy, "wall")).toBe(true);
  });

  it("does not hold when still outside wall trigger range", () => {
    const enemy = mockEnemyInstance({ behavior: "wallSiege" });
    enemy.sprite.y = northWallAttackY() + 200;
    enemy.combat.cooldownMs = 200;
    expect(shouldHoldAtWallMelee(enemy, "wall")).toBe(false);
  });

  it("does not hold when chasing the player", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser" });
    enemy.sprite.y = wallMeleeStandoffY(enemy);
    enemy.combat.cooldownMs = 300;
    expect(shouldHoldAtWallMelee(enemy, "player")).toBe(false);
  });

  it("bruiser keeps half chase speed during melee windup", () => {
    const enemy = mockEnemyInstance({ behavior: "bruiser", speed: 100 });
    enemy.combat.phase = "windup";
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;
    applyChaseVelocity(enemy, 100, 0, 1);
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    const [vx] = setVelocity.mock.calls[0]!;
    expect(vx).toBeCloseTo(50, 1);
  });

  it("grunt still stops movement while attacking", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser", speed: 100 });
    enemy.combat.phase = "windup";
    applyChaseVelocity(enemy, 100, 0, 1);
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).not.toHaveBeenCalled();
  });

  it("zeros velocity and snaps north of standoff back to approach line", () => {
    const enemy = mockEnemyInstance({ behavior: "wallSiege" });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    const approachY = wallMeleeStandoffY(enemy);
    enemy.sprite.y = approachY - 8;
    applyWallMeleeHold(enemy);
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
    expect(enemy.sprite.y).toBe(approachY);
  });
});