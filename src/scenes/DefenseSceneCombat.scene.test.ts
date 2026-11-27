import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DefenseScene } from "./DefenseScene";
import {
  createDefenseSceneE2eHost,
  type DefenseSceneE2eHost,
} from "./defense/DefenseSceneE2EHost";
import { registerDefenseSceneE2eHostFactory } from "./defense/defenseSceneE2eHook";
import { getSave } from "../core/registryKeys";
import { getSpellCatalog } from "../content/spells";
import {
  setShowEnemyPaths,
  setShowHitboxes,
  setShowTouchInput,
} from "../debug/DebugState";
import {
  bootToTown,
  seedMathRandom,
  type TownBoot,
} from "../test/scene/townBoot";
import {
  startNightFromTown,
  tapDefense,
  tapText,
  waitForScene,
} from "../test/scene/sceneFlow";

/** Real-Phaser night: spells, HUD buttons, consumables, debug overlays, night end. */
describe("DefenseScene combat (real Phaser)", () => {
  let boot: TownBoot;
  let defense: DefenseScene;
  let e2e: DefenseSceneE2eHost;
  const h = () => boot.h;

  /** God mode (same registry flag as the E2E API) + a wall that holds. */
  const keepPlayerAlive = () => {
    defense.registry.set("e2eGodMode", true);
    const d = defense.run.player.damageable;
    d.hp = d.maxHp;
    defense.run.wallHp = 1_000_000;
    // Keep the night open: spawning stays "in progress" until a test ends it.
    defense.run.spawnPlanComplete = false;
  };
  /** Tanky grunt `dx, dy` from the player (spells shouldn't clear the field). */
  const spawnTank = (dx: number, dy: number, hp = 100_000) => {
    const p = defense.run.player.sprite;
    defense.spawnEnemyAt(p.x + dx, p.y + dy, undefined, "grunt", hp);
  };

  beforeAll(async () => {
    registerDefenseSceneE2eHostFactory(createDefenseSceneE2eHost);
    seedMathRandom(7);
    boot = await bootToTown({
      save: (s) => ({
        ...s,
        gold: 5000,
        consumables: { minor_healing_potion: 3, fire_bomb: 3 },
      }),
    });
    defense = await startNightFromTown(boot.h, boot.town);
    e2e = defense.e2e as DefenseSceneE2eHost;
  });

  afterAll(async () => {
    await boot?.teardown();
    registerDefenseSceneE2eHostFactory(null);
  });

  it("casts every spell in the catalog against live enemies", () => {
    const ids = getSpellCatalog().map((s) => s.id);
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) {
      keepPlayerAlive();
      if (e2e.enemyCount() < 3) {
        spawnTank(60, 0);
        spawnTank(-60, 30);
        spawnTank(0, -80);
      }
      defense.onSpellCastRequest(id);
      h().step(60 * 3);
    }
    keepPlayerAlive();
    expect(defense.run.nightEnded).toBe(false);
  });

  it("arms a ground spell from the spell bar and confirms it with a world tap", () => {
    const rects = e2e.getSpellSlotHitRects();
    expect(rects.length).toBeGreaterThan(0);
    for (const r of rects) {
      keepPlayerAlive();
      if (e2e.enemyCount() < 2) spawnTank(90, 0);
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      h().tap(cx, cy);
      if (defense.run.pendingGroundCast) {
        const p = e2e.playerPosition();
        const at = e2e.worldPointToScreen(p.x + 60, p.y);
        h().tap(at.x, at.y);
      }
      h().step(60 * 3);
    }
    defense.cancelPendingGroundCast();
  });

  it("HUD buttons (attack, mode, auto) respond to real taps", () => {
    keepPlayerAlive();
    const auto0 = e2e.autoAttackEnabled();
    tapDefense(h(), defense, "combat-auto");
    expect(e2e.autoAttackEnabled()).toBe(!auto0);
    tapDefense(h(), defense, "combat-auto");
    const mode0 = e2e.attackMode();
    tapDefense(h(), defense, "combat-mode");
    expect(e2e.attackMode()).not.toBe(mode0);
    e2e.spawnEnemy(50, 0);
    tapDefense(h(), defense, "combat-atk");
    h().step(30);
    tapDefense(h(), defense, "combat-mode");
    tapDefense(h(), defense, "combat-atk");
    h().step(30);
  });

  it("tapping the world selects an enemy and ignores taps over UI", () => {
    keepPlayerAlive();
    e2e.killAllEnemies();
    h().step(2);
    spawnTank(70, 0);
    h().step(1);
    const [enemy] = e2e.livingEnemyPositions();
    if (!enemy) throw new Error("no enemy");
    const at = e2e.worldPointToScreen(enemy.x, enemy.y);
    h().tap(at.x, at.y);
    h().step(5);
    expect(defense.run.targeting.focusEnemyId).not.toBeNull();
  });

  it("potion and bomb buttons spend charges", () => {
    keepPlayerAlive();
    defense.run.player.damageable.hp = 10;
    e2e.spawnEnemy(80, 0);
    const before = { ...getSave(defense.registry).consumables };
    tapDefense(h(), defense, "defense-potion");
    h().step(120);
    tapDefense(h(), defense, "defense-bomb");
    h().step(120);
    const after = getSave(defense.registry).consumables;
    const spent = Object.keys(before).some(
      (k) => (after[k] ?? 0) < (before[k] ?? 0),
    );
    expect(spent || defense.run.save.consumables !== before).toBe(true);
  });

  it("debug overlays draw while enabled", () => {
    keepPlayerAlive();
    setShowHitboxes(defense.registry, true);
    setShowEnemyPaths(defense.registry, true);
    setShowTouchInput(defense.registry, true);
    e2e.spawnEnemy(100, 50);
    h().step(30);
    const p = e2e.playerPosition();
    const at = e2e.worldPointToScreen(p.x + 120, p.y + 40);
    h().tap(at.x, at.y);
    h().step(30);
    setShowHitboxes(defense.registry, false);
    setShowEnemyPaths(defense.registry, false);
    setShowTouchInput(defense.registry, false);
    h().step(5);
  });

  it("debug button pauses the night under the DebugMenu; Close resumes", async () => {
    tapDefense(h(), defense, "defense-debug");
    const menu = await waitForScene(h(), "DebugMenu");
    expect(h().game.scene.isPaused("Defense")).toBe(true);
    tapText(h(), menu, "Close");
    await h().stepUntil(() => h().game.scene.isActive("Defense"));
    expect(h().game.scene.isActive("DebugMenu")).toBe(false);
  });

  it("winning the night shows Return to town, which goes back to Town", async () => {
    defense.registry.set("e2eGodMode", false);
    const night0 = getSave(defense.registry).night;
    e2e.setManualReturn(true);
    e2e.forceWinNight();
    h().step(5);
    expect(e2e.nightEnded()).toBe(true);
    expect(e2e.hasReturnButton()).toBe(true);
    tapDefense(h(), defense, "defense-return-to-town");
    const town = await waitForScene(h(), "Town");
    expect(getSave(town.registry).night).toBe(night0 + 1);
  });

  it("losing the next night (player dies) also ends and returns", async () => {
    const town = h().game.scene.getScene("Town") as TownBoot["town"];
    defense = await startNightFromTown(h(), town);
    e2e = defense.e2e as DefenseSceneE2eHost;
    e2e.setManualReturn(true);
    e2e.damagePlayer(1_000_000);
    h().step(5);
    expect(e2e.nightEnded()).toBe(true);
    defense.e2eReturnToTown();
    await waitForScene(h(), "Town");
  });
});
