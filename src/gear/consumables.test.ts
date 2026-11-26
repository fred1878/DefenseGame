import { describe, expect, it } from "vitest";
import bundled from "../../public/data/consumables.json";
import { createNewSave } from "../core/GameState";
import { normalizeConsumables } from "../core/normalizeConsumables";
import {
  addConsumable,
  bombBlastSpellDef,
  consumableCount,
  consumableEffectLine,
  consumableKindCount,
  getConsumablesConfig,
  quickConsumable,
  setConsumablesConfig,
  spendConsumable,
} from "./consumables";

const config = normalizeConsumables(bundled);

describe("consumables", () => {
  it("falls back to the bundled file and can be replaced", () => {
    expect(getConsumablesConfig().items.fire_bomb).toBeDefined();
    setConsumablesConfig({ items: {} });
    expect(getConsumablesConfig().items).toEqual({});
    setConsumablesConfig(config);
  });

  it("adds clamped to maxStack and ignores unknown ids", () => {
    const save = createNewSave();
    const a = addConsumable(save, "fire_bomb", 3, config);
    expect(a.added).toBe(3);
    const b = addConsumable(a.save, "fire_bomb", 9, config);
    expect(b.added).toBe(2);
    expect(consumableCount(b.save, "fire_bomb")).toBe(5);
    const c = addConsumable(b.save, "fire_bomb", 1, config);
    expect(c.added).toBe(0);
    expect(c.save).toBe(b.save);
    expect(addConsumable(save, "nope", 1, config)).toEqual({ save, added: 0 });
  });

  it("spends charges and removes empty stacks", () => {
    let save = createNewSave();
    expect(spendConsumable(save, "fire_bomb")).toBeNull();
    save = addConsumable(save, "fire_bomb", 2, config).save;
    save = spendConsumable(save, "fire_bomb")!;
    expect(save.consumables.fire_bomb).toBe(1);
    save = spendConsumable(save, "fire_bomb")!;
    expect(save.consumables).toEqual({});
  });

  it("picks the first owned consumable of a kind in file order", () => {
    let save = createNewSave();
    expect(quickConsumable(save, "heal", config)).toBeNull();
    save = addConsumable(save, "healing_potion", 1, config).save;
    save = addConsumable(save, "frost_bomb", 2, config).save;
    save = addConsumable(save, "thunder_bomb", 1, config).save;
    expect(quickConsumable(save, "heal", config)?.id).toBe("healing_potion");
    save = addConsumable(save, "minor_healing_potion", 1, config).save;
    expect(quickConsumable(save, "heal", config)?.id).toBe(
      "minor_healing_potion",
    );
    expect(quickConsumable(save, "bomb", config)?.id).toBe("frost_bomb");
    expect(consumableKindCount(save, "bomb", config)).toBe(3);
    expect(consumableKindCount(save, "heal", config)).toBe(2);
  });

  it("builds a blast spell def for bombs only", () => {
    const items = config.items;
    expect(bombBlastSpellDef(items.minor_healing_potion!)).toBeNull();
    const fire = bombBlastSpellDef(items.fire_bomb!)!;
    expect(fire.mechanicType).toBe("blast");
    expect(fire.baseDamage).toBe(40);
    expect(fire.onHit).toEqual({ dotDps: 5, dotMs: 3000 });
    const frost = bombBlastSpellDef(items.frost_bomb!)!;
    expect(frost.onHit).toEqual({ slowPct: 45, slowMs: 2500 });
    expect(bombBlastSpellDef(items.thunder_bomb!)!.onHit).toEqual({
      stunMs: 800,
    });
  });

  it("describes effects", () => {
    const items = config.items;
    expect(consumableEffectLine(items.healing_potion!)).toBe("Heals 80 HP");
    expect(consumableEffectLine(items.fire_bomb!)).toBe(
      "40 fire damage in an area, burn 5/s",
    );
    expect(consumableEffectLine(items.frost_bomb!)).toMatch(/slow 45%/);
    expect(consumableEffectLine(items.thunder_bomb!)).toMatch(/stun 0.8s/);
    const { bomb: _b, ...noBomb } = items.fire_bomb!;
    expect(consumableEffectLine(noBomb)).toBe("Bomb");
    const { healHp: _h, ...noHeal } = items.healing_potion!;
    expect(consumableEffectLine(noHeal)).toBe("Heals 0 HP");
  });
});
