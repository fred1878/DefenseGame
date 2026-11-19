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
  it("enemies.json has grunt with core stat fields", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      { hp: number; speed: number; damage: number }
    >;
    const grunt = enemies.grunt;
    expect(grunt).toBeDefined();
    expectFiniteNumber(grunt!.hp, "grunt.hp");
    expectFiniteNumber(grunt!.speed, "grunt.speed");
    expectFiniteNumber(grunt!.damage, "grunt.damage");
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
        combat?: { melee?: { range?: number } };
      }
    >;
    const bruiser = enemies.bruiser;
    expect(bruiser).toBeDefined();
    expect(bruiser!.behavior).toBe("bruiser");
    expect(bruiser!.textureKey).toBe("enemy_bruiser");
    if (bruiser!.combat?.melee?.range != null) {
      expectFiniteNumber(bruiser!.combat.melee.range, "bruiser.combat.melee.range");
    }
  });

  it("javelineer documents combat schema with kite band", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      {
        behavior: string;
        combat?: {
          javelineer?: { minRange?: number; maxRange?: number };
        };
      }
    >;
    const javelineer = enemies.javelineer;
    expect(javelineer?.behavior).toBe("javelineer");
    const kite = javelineer?.combat?.javelineer;
    expect(kite).toBeDefined();
    expectFiniteNumber(kite!.minRange, "javelineer.minRange");
    expectFiniteNumber(kite!.maxRange, "javelineer.maxRange");
  });

  it("arrow_rain_archer documents combat schema with arrowRain block", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      {
        behavior: string;
        combat?: { arrowRain?: { zoneRadius?: number; maxTicks?: number } };
      }
    >;
    const archer = enemies.arrow_rain_archer;
    expect(archer?.behavior).toBe("arrowRainArcher");
    const rain = archer?.combat?.arrowRain;
    expect(rain).toBeDefined();
    expectFiniteNumber(rain!.zoneRadius, "arrowRain.zoneRadius");
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
    expect(frost?.onHit?.rootMs).toBe(7000);

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

  it("enemy-combat-defaults.json defines wall and melee blocks", () => {
    const defs = readJson("enemy-combat-defaults.json") as {
      wall: { damage: number };
      melee: { range: number };
    };
    expectFiniteNumber(defs.wall.damage, "combat-defaults.wall.damage");
    expectFiniteNumber(defs.melee.range, "combat-defaults.melee.range");
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

  it("spell-mechanics and entity-physics json load", () => {
    const spellMech = readJson("spell-mechanics.json") as {
      swingRangeWu: number;
      frostRootMs: number;
    };
    const physics = readJson("entity-physics.json") as {
      entityBodyRadius: { player: number };
    };
    const ai = readJson("enemy-ai.json") as { playerAggroRadius: number };
    expectFiniteNumber(spellMech.swingRangeWu, "spellMech.swingRangeWu");
    expect(spellMech.frostRootMs).toBe(7000);
    expectFiniteNumber(physics.entityBodyRadius.player, "entityBodyRadius.player");
    expectFiniteNumber(ai.playerAggroRadius, "enemyAi.playerAggroRadius");
  });

  it("player.json defines moveSpeed and endless panel seed", () => {
    const player = readJson("player.json") as {
      moveSpeed: number;
      endlessPanelDefaultConcurrent: number;
    };
    expectFiniteNumber(player.moveSpeed, "player.moveSpeed");
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
    expect(typeof store.player.moveSpeed).toBe("number");
    vi.unstubAllGlobals();
  });
});