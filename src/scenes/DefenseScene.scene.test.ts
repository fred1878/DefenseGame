import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DefenseScene } from "./DefenseScene";
import { createDefenseSceneE2eHost } from "./defense/DefenseSceneE2EHost";
import type { DefenseSceneE2eHost } from "./defense/DefenseSceneE2EHost";
import { registerDefenseSceneE2eHostFactory } from "./defense/defenseSceneE2eHook";
import { getSave } from "../core/registryKeys";
import {
  bootToTown,
  seedMathRandom,
  type TownBoot,
} from "../test/scene/townBoot";

/** Tap the real "start night" building and wait for a live DefenseScene. */
async function startNight(boot: TownBoot): Promise<DefenseScene> {
  const { h, town } = boot;
  const target = town.e2eGetUiTapTargets()["start-night"];
  if (!target) throw new Error("no start-night building");
  const { x, y } = target;
  h.tap(x, y);
  await h.stepUntil(
    () => {
      const d = h.game.scene.getScene("Defense") as DefenseScene | null;
      return Boolean(d && h.game.scene.isActive("Defense") && d.e2e?.isReady());
    },
    { maxFrames: 3000 },
  );
  return h.game.scene.getScene("Defense") as DefenseScene;
}

/**
 * Positions/HP after a fixed number of frames from a seeded night start, in a
 * fresh module graph (the loaders cache promises at module level, as the app
 * only ever has one game per page).
 */
async function replayNight(seed: number, frames: number) {
  vi.resetModules();
  const fresh = await import("../test/scene/townBoot");
  const hook = await import("./defense/defenseSceneE2eHook");
  const host = await import("./defense/DefenseSceneE2EHost");
  hook.registerDefenseSceneE2eHostFactory(host.createDefenseSceneE2eHost);
  fresh.seedMathRandom(seed);
  const boot = await fresh.bootToTown();
  try {
    const defense = await startNight(boot);
    boot.h.step(frames);
    const e2e = defense.e2e as DefenseSceneE2eHost;
    return {
      enemies: e2e.livingEnemyPositions(),
      ids: e2e.livingEnemyDefIds(),
      player: e2e.playerPosition(),
      hp: e2e.playerHp(),
      wall: e2e.wallHp(),
    };
  } finally {
    await boot.teardown();
  }
}

describe("DefenseScene (real Phaser, jsdom + canvas)", () => {
  let boot: TownBoot;
  let defense: DefenseScene;
  let e2e: DefenseSceneE2eHost;

  beforeAll(async () => {
    registerDefenseSceneE2eHostFactory(createDefenseSceneE2eHost);
    seedMathRandom(1);
    boot = await bootToTown();
    defense = await startNight(boot);
    e2e = defense.e2e as DefenseSceneE2eHost;
  });

  afterAll(async () => {
    await boot?.teardown();
    registerDefenseSceneE2eHostFactory(null);
  });

  it("starting the night from Town runs the real DefenseScene create()", () => {
    expect(boot.h.game.scene.isActive("Town")).toBe(false);
    expect(getSave(defense.registry).night).toBeGreaterThanOrEqual(1);
    expect(defense.children.list.length).toBeGreaterThan(20);
    expect(e2e.wallHp()).toBeGreaterThan(0);
  });

  it("spawns the wave and enemies advance over simulated time", () => {
    boot.h.step(60 * 8); // 8 simulated seconds
    expect(e2e.enemyCount()).toBeGreaterThan(0);
    const before = e2e.livingEnemyPositions();
    boot.h.step(30);
    const after = e2e.livingEnemyPositions();
    const moved = before.some(
      (p, i) => after[i] && (p.x !== after[i].x || p.y !== after[i].y),
    );
    expect(moved).toBe(true);
  });

  it("virtual stick input moves the player through arcade physics", () => {
    const start = e2e.playerPosition();
    e2e.setStick(1, 0);
    boot.h.step(30);
    e2e.setStick(0, 0);
    const end = e2e.playerPosition();
    expect(end.x).toBeGreaterThan(start.x + 10);
  });

  it("a melee swing damages an adjacent enemy", () => {
    e2e.killAllEnemies();
    boot.h.step(2);
    e2e.spawnEnemy(40, 0);
    boot.h.step(1);
    const hp0 = e2e.livingEnemyHps()[0] ?? 0;
    expect(hp0).toBeGreaterThan(0);
    e2e.tapMelee();
    boot.h.step(60);
    const hps = e2e.livingEnemyHps();
    expect(hps.length === 0 || (hps[0] ?? 0) < hp0).toBe(true);
  });
});

describe("DefenseScene determinism", () => {
  it("same seed + same frames => identical world state", async () => {
    const a = await replayNight(42, 60 * 6);
    const b = await replayNight(42, 60 * 6);
    expect(a.enemies.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });
});
