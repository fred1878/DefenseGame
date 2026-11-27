import { maxNavObstacleClearancePx } from "../../entities/entityPhysics";
import { describe, expect, it, vi } from "vitest";
import { DEFENSE_MAP, DEFENSE_OBSTACLES } from "../../config";
import { defenseHalfWidth } from "../../config/defense";
import { enemyCollisionBodyRadius } from "../../entities/entityPhysics";
import { buildNavGrid } from "../../pathfinding/grid";
import { createEnemyNav } from "../brainShared";
import { mockEnemyInstance } from "../../test/testEnemyInstance";
import {
  applyRetreatPathing,
  applyTangentSlideAwayFromThreat,
  retreatGoalFromThreat,
  snapRetreatGoalToWalkable,
} from "./retreatPathing";
import * as BrainShared from "../brainShared";

describe("retreatPathing", () => {
  const grid = buildNavGrid(
    DEFENSE_OBSTACLES,
    DEFENSE_MAP.cellSize,
    maxNavObstacleClearancePx(),
  );

  it("places flee goals on the away-from-threat vector", () => {
    const goal = retreatGoalFromThreat(0, 0, 100, 0, 80);
    expect(goal).toEqual({ x: -80, y: 0 });
  });

  it("replans with A* when backing from the player", () => {
    const replanSpy = vi.spyOn(BrainShared, "replanEnemyPath");
    const enemy = mockEnemyInstance({
      defId: "arrow_rain_archer",
      behavior: "arrowRainArcher",
      sprite: {
        x: 0,
        y: 120,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    });
    const nav = createEnemyNav();
    nav.replanMs = 0;
    applyRetreatPathing({
      enemy,
      nav,
      grid,
      threatX: 0,
      threatY: 0,
      deltaMs: 16,
      waypointRadius: DEFENSE_MAP.pathWaypointRadius,
      retreatGoalDistPx: 120,
    });
    expect(replanSpy).toHaveBeenCalled();
    replanSpy.mockRestore();
  });

  it("clamps flee snap goals onto the play-field inset", () => {
    const halfW = defenseHalfWidth();
    const r = enemyCollisionBodyRadius("arrow_rain_archer");
    const enemy = mockEnemyInstance({
      defId: "arrow_rain_archer",
      behavior: "arrowRainArcher",
      sprite: {
        x: halfW - r,
        y: 0,
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    });
    const raw = retreatGoalFromThreat(halfW - r, 0, 0, 0, 200);
    expect(raw).not.toBeNull();
    const snapped = snapRetreatGoalToWalkable(
      grid,
      raw!.x,
      raw!.y,
      undefined,
      undefined,
      enemy,
    );
    expect(snapped.x).toBeLessThanOrEqual(halfW - r);
    expect(snapped.x).toBeGreaterThanOrEqual(-halfW + r);
  });

  it("holds when flee and tangents are blocked on a boxed-in cell", () => {
    const rock = DEFENSE_OBSTACLES[0]!;
    const enemy = mockEnemyInstance({
      defId: "arrow_rain_archer",
      behavior: "arrowRainArcher",
      sprite: {
        x: rock.x,
        y: rock.y,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    });
    const moved = applyTangentSlideAwayFromThreat(
      enemy,
      grid,
      rock.x + 200,
      rock.y,
    );
    expect(moved).toBe(false);
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it("returns null when the threat is on top of the enemy", () => {
    expect(retreatGoalFromThreat(10, 10, 10, 10, 80)).toBeNull();
  });

  it("snaps off-map goals back and works without an enemy instance", () => {
    const off = snapRetreatGoalToWalkable(grid, 50_000, 50_000);
    expect(off).toEqual({ x: 50_000, y: 50_000 });
    const mid = snapRetreatGoalToWalkable(grid, 0, 120);
    expect(mid.x).toBeDefined();
    expect(mid.y).toBeDefined();
  });

  it("slides directly away when the flee probe is clear", () => {
    const enemy = mockEnemyInstance({
      defId: "arrow_rain_archer",
      behavior: "arrowRainArcher",
      sprite: {
        x: 0,
        y: 160,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    });
    expect(applyTangentSlideAwayFromThreat(enemy, grid, 0, 0)).toBe(true);
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("uses the default retreat distance when none is provided", () => {
    const enemy = mockEnemyInstance({
      defId: "arrow_rain_archer",
      behavior: "arrowRainArcher",
      sprite: {
        x: 0,
        y: 160,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    });
    const nav = createEnemyNav();
    nav.replanMs = 0;
    applyRetreatPathing({
      enemy,
      nav,
      grid,
      threatX: 0,
      threatY: 0,
      deltaMs: 16,
      waypointRadius: DEFENSE_MAP.pathWaypointRadius,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("clamps a retreat goal without a scene registry", () => {
    const enemy = mockEnemyInstance({
      defId: "arrow_rain_archer",
      behavior: "arrowRainArcher",
      sprite: {
        x: 0,
        y: 160,
        setVelocity: vi.fn(),
        scene: undefined,
      } as never,
    });
    const snapped = snapRetreatGoalToWalkable(
      grid,
      80,
      160,
      undefined,
      undefined,
      enemy,
    );
    expect(snapped.x).toBeDefined();
    expect(snapped.y).toBeDefined();
  });

  it("follows an existing retreat path and ignores a zero-length blend", () => {
    const enemy = mockEnemyInstance({
      defId: "arrow_rain_archer",
      behavior: "arrowRainArcher",
      sprite: {
        x: 0,
        y: 160,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as never,
    });
    const nav = createEnemyNav();
    nav.replanMs = 1000;
    nav.path = [
      { x: 0, y: 160 },
      { x: 80, y: 160 },
    ];
    nav.pathIndex = 0;
    applyRetreatPathing({
      enemy,
      nav,
      grid,
      threatX: 0,
      threatY: 0,
      deltaMs: 16,
      waypointRadius: DEFENSE_MAP.pathWaypointRadius,
      retreatGoalDistPx: 120,
      blendMove: { x: 0, y: 0, weight: 1 },
    });
    expect(nav.pathIndex).toBe(1);
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("uses grid clearance when the scene has no registry", () => {
    const enemy = mockEnemyInstance({
      defId: "arrow_rain_archer",
      behavior: "arrowRainArcher",
      sprite: {
        x: 0,
        y: 160,
        setVelocity: vi.fn(),
        scene: {},
      } as never,
    });
    const nav = createEnemyNav();
    nav.replanMs = 0;
    applyRetreatPathing({
      enemy,
      nav,
      grid,
      threatX: 0,
      threatY: 160,
      deltaMs: 16,
      waypointRadius: DEFENSE_MAP.pathWaypointRadius,
      retreatGoalDistPx: 120,
    });
    expect(nav.path.length).toBe(0);
  });

  it("treats a path with a missing tail as leading toward the threat", () => {
    const enemy = mockEnemyInstance({
      defId: "arrow_rain_archer",
      behavior: "arrowRainArcher",
      sprite: {
        x: 0,
        y: 160,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as never,
    });
    const nav = createEnemyNav();
    nav.replanMs = 1000;
    nav.path = [undefined as never];
    applyRetreatPathing({
      enemy,
      nav,
      grid,
      threatX: 0,
      threatY: 0,
      deltaMs: 16,
      waypointRadius: DEFENSE_MAP.pathWaypointRadius,
    });
    expect(nav.replanMs).toBe(DEFENSE_MAP.pathReplanMs);
  });
});
