import { describe, expect, it, vi } from "vitest";
import { DEFENSE_MAP, DEFENSE_OBSTACLES } from "../../config";
import { defenseHalfWidth } from "../../config/defense";
import { enemyCollisionBodyRadius } from "../../entities/entityPhysics";
import { buildNavGrid } from "../../pathfinding/grid";
import { createEnemyNav } from "../EnemyBrain";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import {
  applyRetreatPathing,
  applyTangentSlideAwayFromThreat,
  retreatGoalFromThreat,
  snapRetreatGoalToWalkable,
} from "./retreatPathing";
import * as EnemyBrain from "../EnemyBrain";

describe("retreatPathing", () => {
  const grid = buildNavGrid(
    DEFENSE_OBSTACLES,
    DEFENSE_MAP.cellSize,
    DEFENSE_MAP.pathClearancePx,
  );

  it("places flee goals on the away-from-threat vector", () => {
    const goal = retreatGoalFromThreat(0, 0, 100, 0, 80);
    expect(goal).toEqual({ x: -80, y: 0 });
  });

  it("replans with A* when backing from the player", () => {
    const replanSpy = vi.spyOn(EnemyBrain, "replanEnemyPath");
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
});
