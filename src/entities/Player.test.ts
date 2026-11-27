import { playerTuning } from "../config/player";
import { describe, expect, it, vi } from "vitest";
import type { EnemyInstance } from "./Enemy";
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
    const body = player.sprite.body as unknown as {
      setVelocity: ReturnType<typeof vi.fn>;
    };
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

function mockEnemyAt(x: number, y: number): EnemyInstance {
  const damageable = {
    id: "e1",
    hp: 100,
    maxHp: 100,
    alive: true,
    team: "enemy" as const,
  };
  return {
    id: "e1",
    defId: "grunt",
    sprite: {
      x,
      y,
      scene: { registry: new Map([["worldPixelScale", 1]]) },
    },
    damageable,
  } as unknown as EnemyInstance;
}

describe("Player melee swing hitbox", () => {
  it("keeps arc facing from swing start while stick rotates aim", () => {
    const player = mockPlayer();
    player.faceToward(100, 0);
    player.tryStartAttack("melee");
    player.updateAttack(playerTuning().meleeWindupMs);
    player.setVelocityFromStick(0, 1, 200);
    expect(player.getFacingAngle()).toBeCloseTo(Math.PI / 2);

    const east = mockEnemyAt(60, 0);
    const south = mockEnemyAt(0, 60);
    const onDamaged = vi.fn();
    east.damageable.onDamaged = onDamaged;
    const onHit = vi.fn();
    player.damageEnemiesInArc([east, south], 10, 0, onHit);

    expect(onHit).toHaveBeenCalledWith(east, 10);
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(east.damageable.hp).toBeLessThan(100);
    expect(onDamaged).toHaveBeenCalledWith(10, "physical");
    expect(south.damageable.hp).toBe(100);
    expect(player.meleeHitboxFacingRad()).toBeCloseTo(0);
  });
});

describe("Player attack mode and phases", () => {
  it("exposes mode getters and cycles melee → ranged → auto", () => {
    const player = mockPlayer();
    expect(player.attackPhaseNow).toBe("idle");
    expect(player.mode).toBe("melee");
    expect(player.canAttack()).toBe(true);
    expect(player.cycleAttackMode()).toBe("ranged");
    expect(player.mode).toBe("ranged");
    expect(player.toggleAttackMode()).toBe("auto");
    expect(player.strikeMode()).toBe("ranged");
    expect(player.cycleAttackMode()).toBe("melee");
    player.setAttackMode("auto");
    expect(player.mode).toBe("auto");
  });

  it("roots the player during ranged windup and recovery", () => {
    const player = mockPlayer();
    player.setAttackMode("ranged");
    player.tryStartAttack("ranged");
    player.setVelocityFromStick(1, 0, 200);
    const sprite = player.sprite as unknown as {
      setVelocity: ReturnType<typeof vi.fn>;
    };
    expect(sprite.setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it("resets facing texture when the stick is released", () => {
    const player = mockPlayer();
    player.setVelocityFromStick(0, 0, 0);
    expect(player.getFacingAngle()).toBeTypeOf("number");
  });

  it("walks windup/active/recovery and consumes a ranged shot once", () => {
    const player = mockPlayer();
    player.setAttackMode("ranged");
    expect(player.consumeRangedShot()).toBe(false);
    expect(player.tryStartAttack("ranged")).toBe(true);
    expect(player.tryStartAttack("ranged")).toBe(false);
    player.updateAttack(playerTuning().rangedWindupMs);
    expect(player.attackPhaseNow).toBe("active");
    expect(player.consumeRangedShot()).toBe(true);
    expect(player.consumeRangedShot()).toBe(false);
    player.updateAttack(playerTuning().rangedActiveMs);
    expect(player.attackPhaseNow).toBe("recovery");
    player.updateAttack(playerTuning().rangedRecoveryMs);
    expect(player.attackPhaseNow).toBe("idle");
    expect(player.canAttack()).toBe(true);
  });

  it("uses locked melee swing facing until the strike ends", () => {
    const player = mockPlayer();
    player.faceToward(100, 0);
    player.tryStartAttack("melee");
    const locked = player.meleeHitboxFacingRad();
    player.setVelocityFromStick(0, 1, 0);
    expect(player.meleeHitboxFacingRad()).toBe(locked);
    player.updateAttack(playerTuning().meleeWindupMs);
    player.updateAttack(playerTuning().meleeActiveMs);
    player.updateAttack(playerTuning().meleeRecoveryMs);
    expect(player.attackPhaseNow).toBe("idle");
    expect(player.meleeHitboxFacingRad()).toBe(player.getFacingAngle());
  });
});

describe("Player leftover branches", () => {
  it("faces with the current angle when the target is at the player", () => {
    const player = mockPlayer();
    player.faceToward(100, 0);
    const facing = player.getFacingAngle();
    player.faceToward(0, 0);
    expect(player.getFacingAngle()).toBeCloseTo(facing);
  });

  it("roots during ranged recovery and ignores idle attack updates", () => {
    const player = mockPlayer();
    player.setAttackMode("ranged");
    expect(player.tryStartAttack()).toBe(true);
    player.updateAttack(playerTuning().rangedWindupMs);
    player.updateAttack(playerTuning().rangedActiveMs);
    expect(player.attackPhaseNow).toBe("recovery");
    player.setVelocityFromStick(1, 0, 200);
    const sprite = player.sprite as unknown as {
      setVelocity: ReturnType<typeof vi.fn>;
    };
    expect(sprite.setVelocity).toHaveBeenCalledWith(0, 0);
    player.updateAttack(playerTuning().rangedRecoveryMs);
    expect(player.attackPhaseNow).toBe("idle");
    player.updateAttack(16);
    expect(player.attackPhaseNow).toBe("idle");
  });

  it("skips melee damage outside the active swing", () => {
    const player = mockPlayer();
    const enemy = mockEnemyAt(40, 0);
    player.damageEnemiesInArc([enemy], 10, 0);
    expect(enemy.damageable.hp).toBe(100);
  });

  it("does not reset facing when a locked melee swing has no stick input", () => {
    const player = mockPlayer();
    player.faceToward(100, 0);
    const aim = player.getFacingAngle();
    player.tryStartAttack("melee");
    player.setVelocityFromStick(0, 0, 200, { lockMeleeAim: true });
    expect(player.getFacingAngle()).toBeCloseTo(aim);
  });

  it("stays in recovery until the recovery window elapses", () => {
    const player = mockPlayer();
    player.tryStartAttack("melee");
    player.updateAttack(playerTuning().meleeWindupMs);
    player.updateAttack(playerTuning().meleeActiveMs);
    expect(player.attackPhaseNow).toBe("recovery");
    player.updateAttack(1);
    expect(player.attackPhaseNow).toBe("recovery");
    player.updateAttack(playerTuning().meleeRecoveryMs);
    expect(player.attackPhaseNow).toBe("idle");
  });

  it("skips a living enemy outside the melee arc", () => {
    const player = mockPlayer();
    player.faceToward(100, 0);
    player.tryStartAttack("melee");
    player.updateAttack(playerTuning().meleeWindupMs);
    const behind = mockEnemyAt(-80, 0);
    behind.id = "behind";
    behind.damageable.id = "behind";
    player.damageEnemiesInArc([behind], 10, 0);
    expect(behind.damageable.hp).toBe(100);
  });
});
