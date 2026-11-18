import { describe, expect, it, vi } from "vitest";
import {
  ENTITY_BODY_RADIUS,
  enemyCollisionBodyRadius,
  enemyPathClearancePx,
  maxNavObstacleClearancePx,
  tuneArcadeDynamicBody,
} from "./entityPhysics";

describe("entityPhysics", () => {
  it("uses tuned collision diameters", () => {
    expect(ENTITY_BODY_RADIUS.player).toBe(17);
    expect(ENTITY_BODY_RADIUS.enemy).toBe(14);
    expect(ENTITY_BODY_RADIUS.enemyMelee).toBe(21);
    expect(ENTITY_BODY_RADIUS.grunt).toBe(28);
  });

  it("widens collision for melee archetypes only", () => {
    expect(enemyCollisionBodyRadius("meleeChaser")).toBe(21);
    expect(enemyCollisionBodyRadius("meleeChaser", "grunt")).toBe(28);
    expect(enemyCollisionBodyRadius("wallSiege")).toBe(21);
    expect(enemyCollisionBodyRadius("stationaryRanged")).toBe(14);
    expect(enemyCollisionBodyRadius("lobber")).toBe(14);
  });

  it("grunt path clearance exceeds other melee grunts archetypes", () => {
    expect(enemyPathClearancePx("grunt", "meleeChaser")).toBe(35);
    expect(enemyPathClearancePx("bruiser", "bruiser")).toBe(28);
    expect(maxNavObstacleClearancePx()).toBe(35);
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