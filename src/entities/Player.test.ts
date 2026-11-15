import { describe, expect, it, vi } from "vitest";
import { Player } from "./Player";

function mockPlayer(hpMax = 100): Player {
  const body = { setVelocity: vi.fn(), setFriction: vi.fn(), pushable: true };
  const sprite = {
    x: 0,
    y: 0,
    body,
    setVelocity: vi.fn(),
    setDisplaySize: vi.fn(),
    setDepth: vi.fn(),
    setCircle: vi.fn(),
    setBounce: vi.fn(),
    setCollideWorldBounds: vi.fn(),
    texture: { key: "player_s" },
    setTexture: vi.fn(),
    scene: { registry: new Map([["worldPixelScale", 1]]) },
  };
  const scene = {
    physics: { add: { sprite: vi.fn(() => sprite) } },
    registry: sprite.scene.registry,
  } as unknown as Phaser.Scene;
  return new Player(scene, 0, 0, hpMax);
}

describe("Player setVelocityFromStick melee aim lock", () => {
  it("keeps facing toward target while moving during auto melee swing", () => {
    const player = mockPlayer();
    player.faceToward(100, 0);
    const aimEast = player.getFacingAngle();
    expect(aimEast).toBeCloseTo(0);

    player.tryStartAttack("melee");
    player.setVelocityFromStick(0, 1, 200, { lockMeleeAim: true });

    expect(player.getFacingAngle()).toBeCloseTo(aimEast);
    const body = player.sprite.body as unknown as { setVelocity: ReturnType<typeof vi.fn> };
    expect(body.setVelocity).toHaveBeenCalledWith(0, 200);
  });

  it("still aligns facing with stick when lock is off", () => {
    const player = mockPlayer();
    player.faceToward(100, 0);
    player.tryStartAttack("melee");
    player.setVelocityFromStick(0, 1, 200);

    expect(player.getFacingAngle()).toBeCloseTo(Math.PI / 2);
  });
});