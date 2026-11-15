import { readFileSync } from "node:fs";
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
    expect(bruiser!.textureKey).toBe("enemy_grunt");
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
      spells: Array<{ id: string; castableInDefense: boolean }>;
    };
    expect(spells.spells.length).toBeGreaterThanOrEqual(21);
    const castable = spells.spells.filter((s) => s.castableInDefense);
    expect(castable.map((s) => s.id)).toEqual(
      expect.arrayContaining(["fire_bolt", "ice_bolt", "lightning_bolt", "fire_nova", "heal"]),
    );
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