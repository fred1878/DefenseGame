import { describe, expect, it, vi } from "vitest";
import { ENTITY_BODY_RADIUS, tuneArcadeDynamicBody } from "./entityPhysics";

describe("entityPhysics", () => {
  it("uses 28px-class collision diameters", () => {
    expect(ENTITY_BODY_RADIUS.player).toBe(14);
    expect(ENTITY_BODY_RADIUS.enemy).toBe(14);
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