import { describe, expect, it, vi } from "vitest";
import type { EnemyKnockbackCarrier } from "../combat/rules/enemyKnockback";
import {
  clampToDefensePlayBounds,
  defensePlayBoundsInset,
  enemyCollisionBodyRadius,
  enemyPathClearancePx,
  enforceEnemyDefenseBounds,
  isMeleeBodyCollisionBehavior,
  maxNavObstacleClearancePx,
  playerBodyRadiusPx,
  playerPathClearancePx,
  tuneArcadeDynamicBody,
} from "./entityPhysics";
import { defenseHalfHeight, defenseHalfWidth } from "../config/defense";
import { ConfigLoadError } from "../core/configValidation";

describe("entityPhysics", () => {
  it("exposes loaded player and enemy body radii", () => {
    expect(playerBodyRadiusPx()).toBeGreaterThan(0);
    expect(enemyCollisionBodyRadius("grunt")).toBeGreaterThan(
      enemyCollisionBodyRadius("sentry_archer"),
    );
    expect(isMeleeBodyCollisionBehavior("meleeChaser")).toBe(true);
    expect(isMeleeBodyCollisionBehavior("lobber")).toBe(false);
  });

  it("agent path clearance vs static nav obstacle clearance", () => {
    expect(enemyPathClearancePx("grunt")).toBeGreaterThan(
      enemyCollisionBodyRadius("grunt"),
    );
    expect(enemyPathClearancePx("bruiser")).toBeGreaterThan(
      enemyCollisionBodyRadius("bruiser"),
    );
    expect(maxNavObstacleClearancePx()).toBe(18);
    expect(playerPathClearancePx()).toBeGreaterThan(playerBodyRadiusPx());
  });

  it("clamps enemy centers to inset defense play bounds", () => {
    const r = 20;
    const bounds = defensePlayBoundsInset(r);
    const halfW = defenseHalfWidth();
    const halfH = defenseHalfHeight();
    expect(bounds.minX).toBe(-halfW + r);
    expect(bounds.maxY).toBe(halfH - r);

    const clamped = clampToDefensePlayBounds(halfW + 80, -halfH - 40, bounds);
    expect(clamped.changed).toBe(true);
    expect(clamped.x).toBe(bounds.maxX);
    expect(clamped.y).toBe(bounds.minY);
  });

  it("recovers off-map enemies by teleporting and zeroing knockback", () => {
    const sprite = {
      x: 4000,
      y: 0,
      setPosition: vi.fn(function (
        this: { x: number; y: number },
        nx: number,
        ny: number,
      ) {
        this.x = nx;
        this.y = ny;
      }),
      setVelocity: vi.fn(),
    };
    const enemy = {
      sprite,
      knockbackVx: 120,
      knockbackVy: -80,
      weight: 100,
    } as unknown as EnemyKnockbackCarrier;
    const r = enemyCollisionBodyRadius("grunt");
    const changed = enforceEnemyDefenseBounds(enemy, r);
    expect(changed).toBe(true);
    expect(sprite.setPosition).toHaveBeenCalled();
    expect(enemy.knockbackVx).toBe(0);
    expect(enemy.knockbackVy).toBe(0);
    expect(sprite.setVelocity).toHaveBeenCalledWith(0, 0);
    const bounds = defensePlayBoundsInset(r);
    expect(sprite.x).toBeLessThanOrEqual(bounds.maxX);
    expect(sprite.x).toBeGreaterThanOrEqual(bounds.minX);
  });

  it("tunes bounce, friction, and pushable", () => {
    const body = {
      pushable: true,
      setFriction: vi.fn(),
    };
    const sprite = {
      displayWidth: 64,
      displayHeight: 64,
      setCircle: vi.fn(),
      setBounce: vi.fn(),
      setCollideWorldBounds: vi.fn(),
      body,
    } as unknown as Phaser.Physics.Arcade.Sprite;

    tuneArcadeDynamicBody(sprite, 14, { pushable: false, worldBounds: true });

    expect(sprite.setCircle).toHaveBeenCalledWith(14, 64 / 2 - 14, 64 / 2 - 14);
    expect(sprite.setBounce).toHaveBeenCalledWith(0, 0);
    expect(body.setFriction).toHaveBeenCalledWith(0, 0);
    expect(body.pushable).toBe(false);
    expect(sprite.setCollideWorldBounds).toHaveBeenCalledWith(true);
  });
});

describe("entityPhysics leftover branches", () => {
  it("throws when an enemy id has no body radius", () => {
    expect(() => enemyCollisionBodyRadius("not_a_real_enemy")).toThrow(
      ConfigLoadError,
    );
  });

  it("leaves pushable and world bounds alone when options are omitted", () => {
    const body = {
      pushable: true,
      setFriction: vi.fn(),
    };
    const sprite = {
      displayWidth: 64,
      displayHeight: 64,
      setCircle: vi.fn(),
      setBounce: vi.fn(),
      setCollideWorldBounds: vi.fn(),
      body,
    } as unknown as Phaser.Physics.Arcade.Sprite;
    tuneArcadeDynamicBody(sprite, 14);
    expect(body.pushable).toBe(true);
    expect(sprite.setCollideWorldBounds).not.toHaveBeenCalled();
  });
});
