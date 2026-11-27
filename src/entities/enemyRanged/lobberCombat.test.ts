import { describe, expect, it, vi } from "vitest";
import type { ArrowRainTelegraph } from "../../combat/fx/ArrowRainTelegraph";
import { resolveEnemyCombat } from "../../core/enemyTuning";
import { shippedEnemyCombat } from "../../test/shippedEnemyCombat";
import { createLobberCombatState } from "./types";
import {
  clearLobberAirborneTelegraph,
  updateLobberCombat,
} from "./lobberCombat";
import { mockEnemyInstance } from "../../test/testEnemyInstance";

describe("updateLobberCombat attack commit", () => {
  const base = shippedEnemyCombat("lobber");
  const combatTuning = resolveEnemyCombat(
    "lobber",
    {
      ...base,
      lobber: {
        ...base.lobber!,
        damage: 12,
        preferredRangeWu: 100,
        attackTriggerRangeWu: 180,
        windupMs: 400,
        activeMs: 80,
        recoveryMs: 300,
        cooldownMs: 800,
        projectileSpeedWu: 200,
        blastRadiusWu: 50,
        blastDamageScale: 0.9,
        kiteBandSlackWu: 22,
      },
    },
    "lobber",
  );

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

    const outOfBand = combatTuning.lobber!.attackTriggerRangeWu + 80;
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

  it("keeps telegraph after recovery when lob is airborne", () => {
    const gfx = {
      clear: vi.fn(),
      lineStyle: vi.fn(),
      fillStyle: vi.fn(),
      strokeCircle: vi.fn(),
      fillCircle: vi.fn(),
      destroy: vi.fn(),
    };
    const telegraph = {
      gfx,
      zoneX: 10,
      zoneY: 20,
      phaseMs: 0,
      windupMs: 400,
      zoneRadius: 50,
      palette: { fill: 0, stroke: 0, inner: 0 },
    } as unknown as ArrowRainTelegraph;
    const enemy = mockEnemyInstance({
      behavior: "lobber",
      combatTuning,
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
    enemy.lobber = {
      ...createLobberCombatState(),
      lobAirborne: true,
      aimX: 10,
      aimY: 20,
      telegraph,
    };
    enemy.combat.phase = "recovery";

    updateLobberCombat(
      enemy,
      {
        kind: "player",
        x: 0,
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
      enemy.lobber!,
      16,
    );

    expect(gfx.destroy).not.toHaveBeenCalled();
    expect(enemy.lobber!.telegraph).toBe(telegraph);
  });

  it("starts a windup when idle and the target is in the volley band", () => {
    const enemy = mockEnemyInstance({
      behavior: "lobber",
      combatTuning,
      damage: 12,
      sprite: {
        x: 0,
        y: 0,
        setVelocity: vi.fn(),
        scene: {
          add: {
            graphics: vi.fn(() => {
              const gfx = {
                destroy: vi.fn(),
                clear: vi.fn(),
                fillStyle: vi.fn(),
                fillCircle: vi.fn(),
                lineStyle: vi.fn(),
                strokeCircle: vi.fn(),
                setDepth: vi.fn(),
              };
              gfx.setDepth.mockReturnValue(gfx);
              return gfx;
            }),
          },
          registry: { get: () => undefined },
        },
      } as never,
    });
    enemy.lobber = createLobberCombatState();
    enemy.combat.phase = "idle";
    enemy.combat.cooldownMs = 0;
    updateLobberCombat(
      enemy,
      {
        kind: "player",
        x: 100,
        y: 0,
        radius: 12,
        damageable: { id: "p", hp: 10, maxHp: 10, alive: true, team: "player" },
      },
      enemy.lobber,
      16,
    );
    expect(enemy.combat.phase).toBe("windup");
    expect(enemy.lobber.telegraph).toBeDefined();
  });

  it("clears an airborne telegraph once the lob lands", () => {
    const enemy = mockEnemyInstance({ behavior: "lobber", combatTuning });
    const gfx = { destroy: vi.fn() };
    enemy.lobber = {
      ...createLobberCombatState(),
      lobAirborne: true,
      telegraph: { gfx } as unknown as ArrowRainTelegraph,
    };
    clearLobberAirborneTelegraph(enemy);
    expect(enemy.lobber.lobAirborne).toBe(false);
    expect(enemy.lobber.telegraph).toBeUndefined();
    expect(gfx.destroy).toHaveBeenCalled();
    clearLobberAirborneTelegraph(enemy);
    expect(gfx.destroy).toHaveBeenCalledOnce();
  });
});
