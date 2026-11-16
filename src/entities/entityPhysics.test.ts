import { describe, expect, it, vi } from "vitest";
import {
  ENTITY_BODY_RADIUS,
  enemyCollisionBodyRadius,
  tuneArcadeDynamicBody,
} from "./entityPhysics";

describe("entityPhysics", () => {
  it("uses tuned collision diameters", () => {
    expect(ENTITY_BODY_RADIUS.player).toBe(17);
    expect(ENTITY_BODY_RADIUS.enemy).toBe(14);
    expect(ENTITY_BODY_RADIUS.enemyMelee).toBe(17);
  });

  it("widens collision for melee archetypes only", () => {
    expect(enemyCollisionBodyRadius("meleeChaser")).toBe(17);
    expect(enemyCollisionBodyRadius("wallSiege")).toBe(17);
    expect(enemyCollisionBodyRadius("stationaryRanged")).toBe(14);
    expect(enemyCollisionBodyRadius("lobber")).toBe(14);
  });

  it("tunes bounce, friction, and pushable", () => {
    const body = {
      pushable: true,
      setFriction: vi.fn(),
    };
    const sprite = {
      setCircle: vi.fn(),
      setBounce: vi.fn(),
      setCollideWorldBounds: vi.fn(),
      body,
    } as unknown as Phaser.Physics.Arcade.Sprite;

    tuneArcadeDynamicBody(sprite, 14, { pushable: false, worldBounds: true });

    expect(sprite.setCircle).toHaveBeenCalledWith(14);
    expect(sprite.setBounce).toHaveBeenCalledWith(0, 0);
    expect(body.setFriction).toHaveBeenCalledWith(0, 0);
    expect(body.pushable).toBe(false);
    expect(sprite.setCollideWorldBounds).toHaveBeenCalledWith(true);
  });
});