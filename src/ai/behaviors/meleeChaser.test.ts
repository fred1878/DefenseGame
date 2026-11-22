import { describe, expect, it, vi } from "vitest";
import { createEnemyNav } from "../EnemyBrain";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import { meleeChaserBehavior } from "./meleeChaser";

describe("meleeChaserBehavior", () => {
  const openGrid = {
    blocked: () => false,
    width: 1,
    height: 1,
    cellSize: 40,
  } as unknown as import("../../pathfinding/grid").NavGrid;

  it("uses LOS direct close when chord to hold is clear", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speed: 80,
    });
    enemy.sprite.x = -120;
    enemy.sprite.y = 0;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [{ x: -40, y: 80 }],
      pathIndex: 0,
      replanMs: 5000,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 0,
      playerY: 0,
      deltaMs: 16,
      objective: "huntPlayer",
    });
    const [vx, vy] = setVelocity.mock.calls.at(-1)!;
    expect(vx).toBeGreaterThan(0);
    expect(Math.abs(vy)).toBeLessThan(Math.abs(vx));
  });

  it("follows path waypoints when a closer ally blocks the player chord", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speed: 80,
    });
    enemy.sprite.x = -100;
    enemy.sprite.y = 0;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [{ x: -35, y: 70 }],
      pathIndex: 0,
      replanMs: 5000,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 0,
      playerY: 0,
      deltaMs: 16,
      objective: "huntPlayer",
      peerAllies: [
        {
          id: "front",
          behavior: "meleeChaser",
          defId: "grunt",
          x: -25,
          y: 0,
        },
      ],
    });
    const [vx, vy] = setVelocity.mock.calls.at(-1)!;
    expect(Math.hypot(vx, vy)).toBeGreaterThan(0);
    expect(vy).toBeGreaterThan(0);
  });

  it("holds after path exhaustion when chord is blocked", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speed: 80,
    });
    enemy.sprite.x = -100;
    enemy.sprite.y = 0;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [{ x: -35, y: 70 }],
      pathIndex: 1,
      replanMs: 5000,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 0,
      playerY: 0,
      deltaMs: 16,
      objective: "huntPlayer",
      peerAllies: [
        {
          id: "front",
          behavior: "meleeChaser",
          defId: "grunt",
          x: -25,
          y: 0,
        },
      ],
    });
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it("follows the last path leg when chord blocked", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speed: 80,
    });
    enemy.sprite.x = -100;
    enemy.sprite.y = 0;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [{ x: -35, y: 70 }, { x: -10, y: 80 }],
      pathIndex: 1,
      replanMs: 5000,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 0,
      playerY: 0,
      deltaMs: 16,
      objective: "huntPlayer",
      peerAllies: [
        {
          id: "front",
          behavior: "meleeChaser",
          defId: "grunt",
          x: -25,
          y: 0,
        },
      ],
    });
    const [vx, vy] = setVelocity.mock.calls.at(-1)!;
    expect(Math.hypot(vx, vy)).toBeGreaterThan(0);
    expect(vy).toBeGreaterThan(0);
  });

  it("does not LOS-bite when a front ally sits ahead on a flanking line", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speed: 80,
    });
    enemy.sprite.x = -100;
    enemy.sprite.y = 60;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [{ x: -35, y: 70 }],
      pathIndex: 0,
      replanMs: 5000,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 0,
      playerY: 0,
      deltaMs: 16,
      objective: "huntPlayer",
      peerAllies: [
        {
          id: "front",
          behavior: "meleeChaser",
          defId: "grunt",
          x: -18,
          y: 0,
        },
      ],
    });
    const [vx, vy] = setVelocity.mock.calls.at(-1)!;
    expect(vy).toBeGreaterThan(0);
    expect(vx).toBeGreaterThan(0);
    expect(Math.hypot(vx, vy)).toBeGreaterThan(0);
  });
});