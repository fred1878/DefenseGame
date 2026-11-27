import { maxNavObstacleClearancePx } from "../entities/entityPhysics";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Damageable } from "../combat/rules/DamageSystem";
import { EnemySpellStatusMap } from "../combat/rules/enemySpellStatus";
import { DEFENSE_MAP } from "../config/defense";
import type { EnemyInstance } from "../entities/Enemy";
import type { EnemyProjectile } from "../entities/Projectile";
import {
  createArrowRainCombatState,
  createJavelineerCombatState,
  createLobberCombatState,
  createRangedHybridCombatState,
  createStationaryRangedCombatState,
} from "../entities/enemyRanged/types";
import { buildNavGrid } from "../pathfinding/grid";
import { tickDefenseEnemies } from "../scenes/defense/DefenseEnemyTick";
import { asScene, fakeScene } from "./fakeScene";
import { mockEnemyInstance } from "./testEnemyInstance";

/** Behaviors cycled through when spawning harness enemies (shipped row per behavior). */
export const HARNESS_BEHAVIORS = [
  "meleeChaser",
  "bruiser",
  "charger",
  "wallSiege",
  "javelineer",
  "stationaryRanged",
  "arrowRainArcher",
  "lobber",
  "rangedHybrid",
  "ward",
] as const;

const DEF_ID_BY_BEHAVIOR: Record<string, string> = {
  meleeChaser: "grunt",
  bruiser: "bruiser",
  arrowRainArcher: "arrow_rain_archer",
  javelineer: "javelineer",
  stationaryRanged: "sentry_archer",
  wallSiege: "slow_siege",
  charger: "charger",
  lobber: "lobber",
  ward: "ward",
  rangedHybrid: "reaver",
};

/** Small deterministic PRNG (mulberry32) so harness runs are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type MovableSprite = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

function movableSprite(
  scene: ReturnType<typeof fakeScene>,
  x: number,
  y: number,
): MovableSprite {
  const sprite = {
    x,
    y,
    vx: 0,
    vy: 0,
    scene,
    setVelocity(vx: number, vy?: number) {
      sprite.vx = vx;
      sprite.vy = vy ?? vx;
      return sprite;
    },
    setPosition(nx: number, ny?: number) {
      sprite.x = nx;
      sprite.y = ny ?? nx;
      return sprite;
    },
  };
  return sprite;
}

export type DefenseTickHarness = {
  enemies: EnemyInstance[];
  step: (deltaMs: number) => void;
  digest: () => string;
  state: {
    wallHp: number;
    playerInvulnMs: number;
    enemyProjectiles: EnemyProjectile[];
    player: Damageable;
  };
};

/**
 * Headless defense enemy loop: `enemyCount` enemies (cycling all shipped
 * behaviors) chase a fixed player / the wall on an empty nav grid. Sprite
 * positions integrate from the velocities the AI sets. Used by the golden
 * behaviour test and the enemy-tick benchmark.
 */
export function createDefenseTickHarness(
  enemyCount: number,
  seed = 1,
): DefenseTickHarness {
  const random = rng(seed);
  const scene = fakeScene();
  // Every FX texture / animation "exists" so combat FX paths run headless.
  scene.textures.exists = () => true;
  scene.anims.exists = () => true;
  scene.anims.get = (key: string) => ({ key, duration: 0 });
  const navGrid = buildNavGrid(
    [],
    DEFENSE_MAP.cellSize,
    maxNavObstacleClearancePx(),
  );
  const enemies: EnemyInstance[] = [];
  for (let i = 0; i < enemyCount; i++) {
    const behavior = HARNESS_BEHAVIORS[i % HARNESS_BEHAVIORS.length]!;
    const x = (random() - 0.5) * 400;
    const y = (random() - 0.5) * 600;
    const enemy = mockEnemyInstance({
      behavior,
      defId: DEF_ID_BY_BEHAVIOR[behavior]!,
      id: `e${i}`,
      sprite: movableSprite(scene, x, y) as unknown as EnemyInstance["sprite"],
      damageable: {
        id: `e${i}`,
        hp: 60,
        maxHp: 60,
        alive: true,
        team: "enemy",
      },
    });
    if (behavior === "arrowRainArcher") {
      enemy.arrowRain = createArrowRainCombatState();
    } else if (behavior === "javelineer") {
      enemy.javelineer = createJavelineerCombatState();
    } else if (behavior === "stationaryRanged") {
      enemy.stationaryRanged = createStationaryRangedCombatState();
    } else if (behavior === "lobber") {
      enemy.lobber = createLobberCombatState();
    } else if (behavior === "rangedHybrid") {
      enemy.rangedHybrid = createRangedHybridCombatState();
    }
    enemies.push(enemy);
  }
  const player: Damageable = {
    id: "p",
    hp: 1e9,
    maxHp: 1e9,
    alive: true,
    team: "player",
  };
  const state = {
    wallHp: 1e9,
    playerInvulnMs: 0,
    enemyProjectiles: [] as EnemyProjectile[],
    player,
  };
  const status = new EnemySpellStatusMap();
  const enemyPathGoals = new Map();
  let serial = 0;
  const step = (deltaMs: number) => {
    scene.time.now += deltaMs;
    const res = tickDefenseEnemies(
      {
        scene: asScene(scene),
        registry: asScene(scene).registry,
        navGrid,
        enemies,
        enemyProjectiles: state.enemyProjectiles,
        enemySpellStatus: status,
        enemyPathGoals,
        wallHp: state.wallHp,
        playerInvulnMs: state.playerInvulnMs,
        playerHurtbox: { x: 0, y: 120, radius: 14, damageable: player },
        nextProjectileId: (prefix) => `${prefix}${serial++}`,
      },
      deltaMs,
    );
    state.wallHp = res.wallHp;
    state.playerInvulnMs = Math.max(0, res.playerInvulnMs - deltaMs);
    state.enemyProjectiles = res.enemyProjectiles;
    for (const e of enemies) {
      const s = e.sprite as unknown as MovableSprite;
      s.x += (s.vx * deltaMs) / 1000;
      s.y += (s.vy * deltaMs) / 1000;
    }
  };
  const digest = () => {
    const rows = enemies.map((e) => {
      const s = e.sprite as unknown as MovableSprite;
      return [
        e.id,
        s.x.toFixed(3),
        s.y.toFixed(3),
        e.damageable.hp,
        e.combat.phase,
      ].join(",");
    });
    rows.push(
      `wall=${state.wallHp}`,
      `player=${player.hp}`,
      `proj=${state.enemyProjectiles.length}`,
    );
    return createHash("sha1").update(rows.join("\n")).digest("hex");
  };
  return { enemies, step, digest, state };
}

/** Hash of the shipped JSON the harness depends on (golden snapshots are keyed by it). */
export function harnessDataHash(): string {
  const dir = path.join(process.cwd(), "public/data");
  const h = createHash("sha1");
  for (const name of [
    "enemies.json",
    "enemy-ai.json",
    "entity-physics.json",
    "defense-maps.json",
    "player.json",
    "hit-flash.json",
  ]) {
    h.update(readFileSync(path.join(dir, name)));
  }
  return h.digest("hex");
}
