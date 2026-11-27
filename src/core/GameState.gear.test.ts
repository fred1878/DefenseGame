import { afterEach, describe, expect, it } from "vitest";
import { SpellCastController } from "../combat/rules/SpellCastController";
import { basePlayerTuning } from "../config/player";
import { getSpellCatalog } from "../content/spells";
import { spellCastMs } from "../content/spellTargeting";
import { getGearCatalog, setGearCatalog } from "../gear/gearCatalog";
import { applyGearLoadout } from "../gear/gearRuntime";
import { createEmptyGear } from "../gear/saveGear";
import { gearFixture } from "../test/gearFixture";
import { getLootConfig, setLootConfig, type LootConfig } from "../gear/loot";
import {
  applyNightResult,
  applyNightResultDetailed,
  createNewSave,
  normalizeSave,
  syncPlayerHpMax,
} from "./GameState";
import type { SaveGame } from "./saveTypes";

const fixture = gearFixture();
const bundled = getGearCatalog();

function withCap(save: SaveGame): SaveGame {
  return {
    ...save,
    gear: {
      items: [
        { uid: 1, baseId: "cap", rarity: "common", itemLevel: 1, affixes: [] },
      ],
      equipped: { helm: 1 },
      nextUid: 2,
    },
  };
}

describe("GameState gear", () => {
  afterEach(() => {
    setGearCatalog(bundled);
    applyGearLoadout(createEmptyGear(), fixture);
  });

  it("starts with empty gear and base max HP", () => {
    const save = createNewSave();
    expect(save.gear).toEqual(createEmptyGear());
    expect(save.player.hpMax).toBe(basePlayerTuning().maxHp);
    expect("weaponId" in save.player).toBe(false);
  });

  it("raises max HP and current HP when gear adds HP, clamps when removed", () => {
    setGearCatalog(fixture);
    const base = createNewSave();
    base.player.hp = 60;
    const geared = syncPlayerHpMax(withCap(base));
    expect(geared.player.hpMax).toBe(base.player.hpMax + 5);
    expect(geared.player.hp).toBe(65);
    expect(syncPlayerHpMax(geared)).toBe(geared);

    const full = {
      ...geared,
      player: { hp: geared.player.hpMax, hpMax: geared.player.hpMax },
    };
    const stripped = syncPlayerHpMax({ ...full, gear: createEmptyGear() });
    expect(stripped.player.hpMax).toBe(base.player.hpMax);
    expect(stripped.player.hp).toBe(base.player.hpMax);
  });

  it("normalizes gear and drops a legacy weaponId on load", () => {
    setGearCatalog(fixture);
    const raw = withCap(createNewSave()) as SaveGame & {
      player: SaveGame["player"] & { weaponId?: string };
    };
    raw.player = { ...raw.player, weaponId: "sword" };
    raw.gear.items.push({
      uid: 9,
      baseId: "ghost",
      rarity: "common",
      itemLevel: 1,
      affixes: [],
    });
    const save = normalizeSave(raw);
    expect(save.gear.items.map((i) => i.uid)).toEqual([1]);
    expect("weaponId" in save.player).toBe(false);
    expect(save.player.hpMax).toBe(basePlayerTuning().maxHp + 5);
  });

  it("shortens spell cooldowns by gear cooldown reduction", () => {
    const def = getSpellCatalog().find(
      (d) => spellCastMs(d) <= 0 && d.channelMs <= 0 && d.cooldownMs > 0,
    )!;
    expect(def).toBeDefined();
    applyGearLoadout(
      {
        items: [
          {
            uid: 1,
            baseId: "band",
            rarity: "magic",
            itemLevel: 1,
            affixes: [{ id: "of_quick", value: 25, spell: def.id }],
          },
        ],
        equipped: { ring1: 1 },
        nextUid: 2,
      },
      fixture,
    );
    const c = new SpellCastController();
    expect(c.tryBeginCast(def.id)).toBe(def);
    expect(c.getCooldownRemaining(def.id)).toBeCloseTo(def.cooldownMs * 0.75);
  });
});

describe("applyNightResult drops", () => {
  afterEach(() => setGearCatalog(bundled));

  it("adds night-end drops to the bag", () => {
    setGearCatalog(fixture);
    const save = createNewSave();
    const next = applyNightResult(save, {
      won: true,
      goldEarned: 5,
      wallDamage: 0,
      night: 1,
      drops: [{ baseId: "cap", rarity: "magic", itemLevel: 2, affixes: [] }],
    });
    expect(next.gear.items).toEqual([
      { uid: 1, baseId: "cap", rarity: "magic", itemLevel: 2, affixes: [] },
    ]);
    expect(next.gold).toBe(save.gold + 5);
    const none = applyNightResult(save, {
      won: false,
      goldEarned: 0,
      wallDamage: 0,
      night: 1,
      drops: [],
    });
    expect(none.gear.items).toEqual([]);
  });

  it("reports overflow sales when the bag is full", () => {
    setGearCatalog(fixture);
    const previous = getLootConfig();
    const tight: LootConfig = {
      ...previous,
      inventoryCapacity: 0,
      sellBackPct: 50,
    };
    setLootConfig(tight);
    try {
      const save = createNewSave();
      save.gold = 3;
      const applied = applyNightResultDetailed(
        save,
        {
          won: true,
          goldEarned: 5,
          wallDamage: 0,
          night: 1,
          drops: [
            { baseId: "cap", rarity: "common", itemLevel: 1, affixes: [] },
          ],
        },
        fixture,
        tight,
      );
      expect(applied.save.gear.items).toEqual([]);
      expect(applied.soldCount).toBe(1);
      expect(applied.soldGold).toBeGreaterThan(0);
      expect(applied.save.gold).toBe(3 + 5 + applied.soldGold);
    } finally {
      setLootConfig(previous);
    }
  });
});
