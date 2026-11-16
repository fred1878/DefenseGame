import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DataStore } from "./DataStore";

const dataDir = path.join(process.cwd(), "public/data");

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(path.join(dataDir, name), "utf8"));
}

describe("public data fixtures", () => {
  it("enemies.json has grunt with sane stats", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      { hp: number; speed: number; damage: number }
    >;
    const grunt = enemies.grunt;
    expect(grunt).toBeDefined();
    expect(grunt!.hp).toBeGreaterThan(0);
    expect(grunt!.speed).toBeGreaterThan(0);
    expect(grunt!.damage).toBeGreaterThan(0);
  });

  it("enemies.json defines displayName for every type", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      { displayName: string }
    >;
    expect(Object.keys(enemies)).toHaveLength(11);
    for (const row of Object.values(enemies)) {
      expect(row.displayName.trim().length).toBeGreaterThan(0);
      expect(row.displayName).not.toMatch(/_/);
    }
    expect(enemies.sentry_archer?.displayName).toBe("Sentry Archer");
  });

  it("enemies.json bruiser is slower than grunt with long reach behavior id", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      {
        hp: number;
        speed: number;
        behavior: string;
        textureKey: string;
        combat?: { melee?: { range?: number } };
      }
    >;
    const bruiser = enemies.bruiser;
    const grunt = enemies.grunt;
    expect(bruiser).toBeDefined();
    expect(bruiser!.speed).toBeLessThan(grunt!.speed);
    expect(bruiser!.behavior).toBe("bruiser");
    expect(bruiser!.textureKey).toBe("enemy_bruiser");
    expect(bruiser!.combat?.melee?.range).toBeGreaterThan(30);
  });

  it("javelineer documents combat schema with kite band", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      { behavior: string; combat?: { javelineer?: { maxRange?: number } } }
    >;
    const javelineer = enemies.javelineer;
    expect(javelineer?.behavior).toBe("javelineer");
    expect(javelineer?.combat?.javelineer?.maxRange).toBe(198);
  });

  it("arrow_rain_archer documents combat schema with merged defaults", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      { behavior: string; combat?: { arrowRain?: { zoneRadius?: number } } }
    >;
    const archer = enemies.arrow_rain_archer;
    expect(archer?.combat?.arrowRain?.zoneRadius).toBe(72);
  });

  it("enemies.json assigns a unique textureKey per id", () => {
    const enemies = readJson("enemies.json") as Record<
      string,
      { textureKey: string }
    >;
    const keys = Object.values(enemies).map((e) => e.textureKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const [id, row] of Object.entries(enemies)) {
      expect(row.textureKey).toBe(`enemy_${id}`);
    }
  });

  it("waves.json night 1 has groups", () => {
    const waves = readJson("waves.json") as Record<
      string,
      { rewardGold: number; groups: unknown[] }
    >;
    const wave1 = waves["1"];
    expect(wave1).toBeDefined();
    expect(wave1!.rewardGold).toBeGreaterThan(0);
    expect(wave1!.groups.length).toBeGreaterThan(0);
  });

  it("spells.json lists MobileRPG catalog with defense castables", () => {
    const spells = readJson("spells.json") as {
      spells: Array<{
        id: string;
        castableInDefense: boolean;
        iconFile?: string;
        projectileTextureKey?: string;
        projectileFile?: string;
        blastTextureKey?: string;
        blastFile?: string;
      }>;
    };
    expect(spells.spells.length).toBeGreaterThanOrEqual(21);
    const castable = spells.spells.filter((s) => s.castableInDefense);
    expect(castable.length).toBeGreaterThanOrEqual(18);
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

  it("buildings.json defines wall costs", () => {
    const buildings = readJson("buildings.json") as Record<
      string,
      { maxLevel: number; costByLevel: number[] }
    >;
    const wall = buildings.wall;
    expect(wall).toBeDefined();
    expect(wall!.maxLevel).toBeGreaterThan(0);
    expect(wall!.costByLevel[0]).toBeGreaterThan(0);
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
    vi.unstubAllGlobals();
  });
});