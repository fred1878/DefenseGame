import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DataStore } from "./DataStore";

const dataDir = path.join(process.cwd(), "public/data");

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(path.join(dataDir, name), "utf8"));
}

function expectFiniteNumber(value: unknown, label: string): void {
  expect(typeof value, label).toBe("number");
  expect(Number.isFinite(value as number), label).toBe(true);
}

describe("public data fixtures", () => {
  it("enemies.json rows include required hp, speed, damage, and weight", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      {
        hp?: number;
        speedWu?: number;
        damage?: number;
        weight?: number;
        challengeRating?: number;
        bodyRadiusWu?: number;
      }
    >;
    for (const [id, row] of Object.entries(enemies)) {
      expectFiniteNumber(row.hp, `enemies.${id}.hp`);
      expectFiniteNumber(row.speedWu, `enemies.${id}.speedWu`);
      expectFiniteNumber(row.damage, `enemies.${id}.damage`);
      expectFiniteNumber(row.bodyRadiusWu, `enemies.${id}.bodyRadiusWu`);
      expectFiniteNumber(row.weight, `enemies.${id}.weight`);
      expect((row.weight as number) > 0, `enemies.${id}.weight > 0`).toBe(true);
      expectFiniteNumber(row.challengeRating, `enemies.${id}.challengeRating`);
      expect((row.challengeRating as number) >= 0, `enemies.${id}.challengeRating >= 0`).toBe(
        true,
      );
    }
  });

  it("enemies.json defines displayName for every type", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      { displayName: string }
    >;
    expect(Object.keys(enemies).length).toBeGreaterThan(0);
    for (const row of Object.values(enemies)) {
      expect(typeof row.displayName).toBe("string");
      expect(row.displayName.trim().length).toBeGreaterThan(0);
      expect(row.displayName).not.toMatch(/_/);
    }
  });

  it("enemies.json bruiser has expected behavior id", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      {
        behavior: string;
        textureKey: string;
        combat?: { melee?: { rangeWu?: number } };
      }
    >;
    const bruiser = enemies.bruiser;
    expect(bruiser).toBeDefined();
    expect(bruiser!.behavior).toBe("bruiser");
    expect(bruiser!.textureKey).toBe("enemy_bruiser");
    if (bruiser!.combat?.melee?.rangeWu != null) {
      expectFiniteNumber(bruiser!.combat.melee.rangeWu, "bruiser.combat.melee.rangeWu");
    }
  });

  it("melee player-chase behaviors define combat.melee.meleeChaseStandoffWu", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      {
        behavior: string;
        combat?: { melee?: { meleeChaseStandoffWu?: number } };
      }
    >;
    const chaseBehaviors = new Set([
      "meleeChaser",
      "bruiser",
      "wallSiege",
      "charger",
      "ward",
      "rangedHybrid",
    ]);
    for (const [id, row] of Object.entries(enemies)) {
      if (!chaseBehaviors.has(row.behavior)) continue;
      expectFiniteNumber(
        row.combat?.melee?.meleeChaseStandoffWu,
        `enemies.${id}.combat.melee.meleeChaseStandoffWu`,
      );
    }
  });

  it("ranged-only melee-activation behaviors omit per-enemy combat.melee", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      {
        behavior: string;
        combat?: { melee?: unknown };
      }
    >;
    const rangedOnly = new Set([
      "arrowRainArcher",
      "javelineer",
      "stationaryRanged",
      "lobber",
    ]);
    for (const [id, row] of Object.entries(enemies)) {
      if (!rangedOnly.has(row.behavior)) continue;
      expect(row.combat?.melee, `enemies.${id}.combat.melee`).toBeUndefined();
    }
  });

  it("javelineer documents combat schema with kite band", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      {
        behavior: string;
        combat?: {
          javelineer?: { minRangeWu?: number; maxRangeWu?: number };
        };
      }
    >;
    const javelineer = enemies.javelineer;
    expect(javelineer?.behavior).toBe("javelineer");
    const kite = javelineer?.combat?.javelineer;
    expect(kite).toBeDefined();
    expectFiniteNumber(kite!.minRangeWu, "javelineer.minRangeWu");
    expectFiniteNumber(kite!.maxRangeWu, "javelineer.maxRangeWu");
  });

  it("arrow_rain_archer documents combat schema with arrowRain block", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      {
        behavior: string;
        combat?: { arrowRain?: { zoneRadiusWu?: number; maxTicks?: number } };
      }
    >;
    const archer = enemies.arrow_rain_archer;
    expect(archer?.behavior).toBe("arrowRainArcher");
    const rain = archer?.combat?.arrowRain;
    expect(rain).toBeDefined();
    expectFiniteNumber(rain!.zoneRadiusWu, "arrowRain.zoneRadiusWu");
    expectFiniteNumber(rain!.maxTicks, "arrowRain.maxTicks");
  });

  it("enemies.json assigns textureKey per id (reuse allowed when documented)", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      { textureKey: string }
    >;
    const textureReuse: Record<string, string> = {};
    for (const [id, row] of Object.entries(enemies)) {
      expect(row.textureKey).toBe(textureReuse[id] ?? `enemy_${id}`);
    }
    expect(enemies.reaver?.textureKey).toBe("enemy_reaver");
  });

  it("waves.json night 1 has groups", () => {
    const waves = readJson("waves.json") as Record<
      string,
      { rewardGold: number; groups: unknown[] }
    >;
    const wave1 = waves["1"];
    expect(wave1).toBeDefined();
    expectFiniteNumber(wave1!.rewardGold, "wave1.rewardGold");
    expect(Array.isArray(wave1!.groups)).toBe(true);
    expect(wave1!.groups.length).toBeGreaterThan(0);
  });

  it("spells.json lists MobileRPG catalog with defense castables", () => {
    const spells = readJson("spells.json") as {
      spells: Array<{
        id: string;
        onHit?: { rootMs?: number };
        castableInDefense: boolean;
        iconFile?: string;
        projectileTextureKey?: string;
        projectileFile?: string;
        blastTextureKey?: string;
        blastFile?: string;
      }>;
    };
    expect(spells.spells.length).toBeGreaterThan(0);
    const castable = spells.spells.filter((s) => s.castableInDefense);
    expect(castable.length).toBeGreaterThan(0);
    expect(castable.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        "fire_bolt",
        "ice_bolt",
        "lightning_bolt",
        "fire_nova",
        "heal",
        "flash_heal",
        "water_bolt",
        "arc_bomb",
        "swing",
        "rend",
        "cone_of_cold",
        "cone_of_fire",
        "fire_blast",
        "frost_nova",
        "blizzard",
        "meteor",
        "flamestrike",
        "deep_freeze",
        "chain_lightning",
        "combustion",
        "ice_wall",
        "shadowform",
        "blink",
      ]),
    );
    const frost = spells.spells.find((s) => s.id === "frost_nova");
    expect(frost?.onHit?.rootMs).toBeDefined();

    const iconDir = path.join(process.cwd(), "public/assets/spells/icons");
    const fxDir = path.join(process.cwd(), "public/assets/spells/fx");
    for (const s of spells.spells) {
      expect(s.iconFile).toBeTruthy();
      expect(s.iconFile).not.toMatch(/combat\/|generated|placeholder|stub/i);
      expect(
        existsSync(path.join(iconDir, s.iconFile!)),
        `${s.id} icon missing: ${s.iconFile}`,
      ).toBe(true);
      if (s.projectileTextureKey) {
        expect(s.projectileTextureKey).toMatch(/^fx_spell_/);
        expect(s.projectileTextureKey).not.toBe("fx_fire_bolt");
        expect(s.projectileFile).toBeTruthy();
        expect(existsSync(path.join(fxDir, s.projectileFile!))).toBe(true);
      }
      if (s.blastTextureKey) {
        expect(s.blastTextureKey).toMatch(/^fx_spell_/);
        expect(s.blastFile).toBeTruthy();
        expect(existsSync(path.join(fxDir, s.blastFile!))).toBe(true);
      }
    }
  });

  it("enemies.json rows define explicit wall combat (melee when required)", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      {
        behavior: string;
        combat: {
          wall: { damage: number; triggerRangeWu: number; hitRangeWu: number };
          melee?: { rangeWu: number; triggerRangeWu: number };
        };
      }
    >;
    const rangedOnly = new Set([
      "arrowRainArcher",
      "javelineer",
      "stationaryRanged",
      "lobber",
    ]);
    for (const [id, row] of Object.entries(enemies)) {
      expectFiniteNumber(row.combat.wall.damage, `${id}.combat.wall.damage`);
      if (rangedOnly.has(row.behavior)) {
        expect(row.combat.melee, `${id}.combat.melee`).toBeUndefined();
        continue;
      }
      expectFiniteNumber(row.combat.melee!.rangeWu, `${id}.combat.melee.rangeWu`);
      expectFiniteNumber(
        row.combat.melee!.triggerRangeWu,
        `${id}.combat.melee.triggerRangeWu`,
      );
    }
  });

  it("defense-maps.json defines default night-field layout", () => {
    const maps = readJson("defense-maps.json") as {
      defaultMapId: string;
      maps: { id: string; obstacles: unknown[] }[];
    };
    expect(typeof maps.defaultMapId).toBe("string");
    expect(maps.maps.some((m) => m.id === maps.defaultMapId)).toBe(true);
    const active = maps.maps.find((m) => m.id === maps.defaultMapId);
    expect(active).toBeDefined();
    expect(Array.isArray(active!.obstacles)).toBe(true);
  });

  it("hit-flash.json defines duration and flavor entries", () => {
    const hitFlash = readJson("hit-flash.json") as {
      durationMs: number;
      flavors: Record<
        string,
        {
          tint: number;
          mode: string;
          peakAlpha: number;
          colorFade: boolean;
          alphaFade: boolean;
        }
      >;
    };
    expectFiniteNumber(hitFlash.durationMs, "hit-flash.durationMs");
    for (const flavor of ["physical", "fire", "frost", "water"]) {
      const entry = hitFlash.flavors[flavor];
      expect(entry, `hit-flash.flavors.${flavor}`).toBeDefined();
      expectFiniteNumber(entry!.tint, `hit-flash.flavors.${flavor}.tint`);
      expect(["fill", "multiply"]).toContain(entry!.mode);
      expectFiniteNumber(
        entry!.peakAlpha,
        `hit-flash.flavors.${flavor}.peakAlpha`,
      );
      expect(typeof entry!.colorFade).toBe("boolean");
      expect(typeof entry!.alphaFade).toBe("boolean");
    }
  });

  it("entity-physics and enemy-ai json load", () => {
    const physics = readJson("entity-physics.json") as {
      enemyPathClearanceMarginWu: number;
      staticObstacleNavClearanceWu: number;
      knockbackVelocityCapMult: number;
    };
    const ai = readJson("enemy-ai.json") as { playerAggroRadiusWu: number };
    expectFiniteNumber(
      physics.enemyPathClearanceMarginWu,
      "entity-physics.enemyPathClearanceMarginWu",
    );
    expectFiniteNumber(
      physics.staticObstacleNavClearanceWu,
      "entity-physics.staticObstacleNavClearanceWu",
    );
    expectFiniteNumber(
      physics.knockbackVelocityCapMult,
      "entity-physics.knockbackVelocityCapMult",
    );
    expectFiniteNumber(ai.playerAggroRadiusWu, "enemyAi.playerAggroRadiusWu");
  });

  it("player.json defines moveSpeedWu and endless panel seed", () => {
    const player = readJson("player.json") as {
      moveSpeedWu: number;
      bodyRadiusWu: number;
      endlessPanelDefaultConcurrent: number;
    };
    expectFiniteNumber(player.moveSpeedWu, "player.moveSpeedWu");
    expectFiniteNumber(player.bodyRadiusWu, "player.bodyRadiusWu");
    expectFiniteNumber(
      player.endlessPanelDefaultConcurrent,
      "player.endlessPanelDefaultConcurrent",
    );
  });

  it("buildings.json defines wall costs", () => {
    const buildings = readJson("buildings.json") as Record<
      string,
      { maxLevel: number; costByLevel: number[] }
    >;
    const wall = buildings.wall;
    expect(wall).toBeDefined();
    expectFiniteNumber(wall!.maxLevel, "wall.maxLevel");
    expect(Array.isArray(wall!.costByLevel)).toBe(true);
    expect(wall!.costByLevel.length).toBeGreaterThan(0);
    expectFiniteNumber(wall!.costByLevel[0], "wall.costByLevel[0]");
  });
});

describe("DataStore.loadTownBoot", () => {
  it("loads town json only", async () => {
    const store = new DataStore();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const href = typeof url === "string" ? url : url.toString();
        const name = href.split("/").pop() ?? "";
        const body = readFileSync(path.join(dataDir, name), "utf8");
        return new Response(body, { status: 200 });
      }),
    );
    await store.loadTownBoot("https://example.test/");
    expect(store.buildings.wall).toBeDefined();
    expect(store.townBuildings).toBeTruthy();
    expect(store.defenseDataReady).toBe(false);
    expect(Object.keys(store.enemies)).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});

describe("DataStore.loadAll", () => {
  it("loads json via mocked fetch", async () => {
    const store = new DataStore();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const href = typeof url === "string" ? url : url.toString();
        const name = href.split("/").pop() ?? "";
        const body = readFileSync(path.join(dataDir, name), "utf8");
        return new Response(body, { status: 200 });
      }),
    );
    await store.loadAll("https://example.test/");
    expect(store.enemies.grunt).toBeDefined();
    expect(store.getWaveForNight(1)?.groups.length).toBeGreaterThan(0);
    expect(store.buildings.wall).toBeDefined();
    expect(store.spells.length).toBeGreaterThan(0);
    expect(typeof store.player.moveSpeedWu).toBe("number");
    vi.unstubAllGlobals();
  });
});