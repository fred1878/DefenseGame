import { describe, expect, it, vi } from "vitest";
import { resolveEnemyCombat } from "../../core/enemyTuning";
import { createLobberCombatState } from "./types";
import { updateLobberCombat } from "./lobberCombat";
import { mockEnemyInstance } from "../testEnemyInstance";

describe("updateLobberCombat attack commit", () => {
  const combatTuning = resolveEnemyCombat("lobber", {
    lobber: {
      preferredRange: 100,
      attackTriggerRange: 180,
      windupMs: 400,
      activeMs: 80,
      recoveryMs: 300,
      cooldownMs: 800,
      projectileSpeed: 200,
      blastRadius: 50,
      blastDamageScale: 0.9,
    },
  });

  it("throws at committed aim after player leaves band", () => {
    const enemy = mockEnemyInstance({
      behavior: "lobber",
      combatTuning,
      damage: 12,
      sprite: {
        x: 0,
        y: 0,
        setVelocity: vi.fn(),
        scene: {
          add: { graphics: vi.fn(() => ({ destroy: vi.fn() })) },
          registry: { get: () => undefined },
        },
      } as never,
    });
    enemy.lobber = createLobberCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.attackTargetKind = "player";
    enemy.lobber.aimX = 120;
    enemy.lobber.aimY = 40;

    const outOfBand = combatTuning.lobber!.attackTriggerRange + 80;
    const result = updateLobberCombat(
      enemy,
      {
        kind: "player",
        x: outOfBand,
        y: 0,
        radius: 14,
        damageable: {
          id: "p",
          hp: 50,
          maxHp: 50,
          alive: true,
          team: "player",
        },
      },
      enemy.lobber,
      16,
    );

    expect(result.spawnLob).toBeDefined();
    expect(result.spawnLob?.toX).toBe(120);
    expect(result.spawnLob?.toY).toBe(40);
  });
});