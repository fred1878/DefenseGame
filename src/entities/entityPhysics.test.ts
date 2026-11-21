import { describe, expect, it, vi } from "vitest";
import {
  enemyCollisionBodyRadius,
  enemyPathClearancePx,
  isMeleeBodyCollisionBehavior,
  maxNavObstacleClearancePx,
  playerBodyRadiusPx,
  tuneArcadeDynamicBody,
} from "./entityPhysics";

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