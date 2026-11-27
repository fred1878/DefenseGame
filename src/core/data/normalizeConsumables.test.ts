import { describe, expect, it } from "vitest";
import bundled from "../../../public/data/consumables.json";
import { COMBAT_FX_TEXTURE } from "../../content/assets";
import { normalizeConsumables } from "./normalizeConsumables";

const heal = {
  name: "P",
  kind: "heal",
  price: 1,
  maxStack: 2,
  cooldownMs: 10,
  healHp: 5,
};
const bomb = {
  name: "B",
  kind: "bomb",
  price: 1,
  maxStack: 2,
  cooldownMs: 10,
  bomb: {
    damage: 1,
    radiusWu: 2,
    rangeWu: 3,
    flavor: "fire",
    knockbackWu: 0,
    projectile: "spellArcBomb",
    blast: "spellFireNova",
  },
};

describe("normalizeConsumables", () => {
  it("accepts the shipped file", () => {
    const cfg = normalizeConsumables(bundled);
    expect(Object.keys(cfg.items).length).toBeGreaterThanOrEqual(5);
  });

  it("maps fx names to texture keys and keeps optional effects", () => {
    const cfg = normalizeConsumables({
      items: { b: { ...bomb, bomb: { ...bomb.bomb, stunMs: 100 } }, h: heal },
    });
    expect(cfg.items.b!.bomb!.projectile).toBe(COMBAT_FX_TEXTURE.spellArcBomb);
    expect(cfg.items.b!.bomb!.stunMs).toBe(100);
    expect(cfg.items.b!.bomb!.dotDps).toBeUndefined();
    expect(cfg.items.h!.healHp).toBe(5);
  });

  it("rejects bad rows", () => {
    expect(() => normalizeConsumables({})).toThrow(/consumables.items/);
    expect(() =>
      normalizeConsumables({ items: { h: { ...heal, healHp: undefined } } }),
    ).toThrow(/healHp/);
    expect(() =>
      normalizeConsumables({ items: { h: { ...heal, kind: "x" } } }),
    ).toThrow();
    expect(() =>
      normalizeConsumables({
        items: { b: { ...bomb, bomb: { ...bomb.bomb, blast: "nope" } } },
      }),
    ).toThrow(/blast/);
    expect(() =>
      normalizeConsumables({ items: { b: { ...bomb, bomb: undefined } } }),
    ).toThrow();
  });
});
