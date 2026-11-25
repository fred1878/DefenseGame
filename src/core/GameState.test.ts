import { describe, expect, it, vi } from "vitest";
import { PLAYER_TUNING, SPELL_BAR } from "../config";
import { applyPlayerTuning } from "../config/player";
import {
  DefenseSpellDirector,
  type DefenseSpellDirectorHost,
} from "../scenes/defense/DefenseSpellDirector";
import { SAVE_VERSION, type SaveGame } from "./saveTypes";
import { saveStorageKey } from "../e2e/e2eMode";
import {
  applyEndlessRunExit,
  applyNightResult,
  createNewSave,
  loadSave,
  playerDamageMult,
  prepareDefenseNight,
  persistSave,
  resetSaveAndReload,
  wallHpBonusFromBuildings,
} from "./GameState";

describe("GameState", () => {
  it("loadSave drops legacy player.moveSpeed from save blob", () => {
    const tuningMoveSpeed = 222;
    applyPlayerTuning({ ...PLAYER_TUNING, moveSpeedWu: tuningMoveSpeed });

    const base = createNewSave();
    const legacySave = {
      ...base,
      player: { ...base.player, moveSpeed: 73 },
    } as SaveGame & { player: SaveGame["player"] & { moveSpeed: number } };

    const key = saveStorageKey();
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => {
        items.set(k, v);
      },
      removeItem: (k: string) => {
        items.delete(k);
      },
    });
    items.set(key, JSON.stringify({ version: SAVE_VERSION, save: legacySave }));

    const loaded = loadSave();
    expect(loaded.player).not.toHaveProperty("moveSpeed");
    expect(PLAYER_TUNING.moveSpeedWu).toBe(tuningMoveSpeed);
    vi.unstubAllGlobals();
  });

  it("Defense movement uses PLAYER_TUNING (not save) for stick velocity", () => {
    const tuningMoveSpeed = 333;
    applyPlayerTuning({ ...PLAYER_TUNING, moveSpeedWu: tuningMoveSpeed });

    const setVelocityFromStick = vi.fn();
    const host = {
      scene: { registry: { get: () => undefined } } as unknown as Phaser.Scene,
      save: createNewSave(),
      player: {
        sprite: { x: 0, y: 0, setVelocity: vi.fn() },
        setVelocityFromStick,
        faceToward: vi.fn(),
      },
      targeting: { facingTarget: vi.fn(() => null) },
      wu: (n: number) => n,
    } as unknown as DefenseSpellDirectorHost;

    const director = new DefenseSpellDirector(host);
    (
      director as unknown as {
        resumeMovementFromStick: (
          dir: { x: number; y: number },
          lock: () => boolean,
        ) => void;
      }
    ).resumeMovementFromStick({ x: 1, y: 0 }, () => false);

    expect(setVelocityFromStick).toHaveBeenCalledWith(
      1,
      0,
      tuningMoveSpeed,
      expect.objectContaining({ lockMeleeAim: false }),
    );
  });

  it("creates a valid starting save", () => {
    const save = createNewSave();
    expect(save.night).toBe(1);
    expect(save.townWallHp).toBe(save.townWallHpMax);
    expect(save.player.hp).toBe(save.player.hpMax);
    expect(save.player).not.toHaveProperty("moveSpeed");
    expect(save.spellBar.slots).toHaveLength(SPELL_BAR.slotCount);
  });

  it("applies a won night", () => {
    const save = createNewSave();
    const result = {
      won: true,
      goldEarned: 40,
      wallDamage: 5,
      night: 1,
    };
    const next = applyNightResult(save, result);
    expect(next.gold).toBe(40);
    expect(next.night).toBe(2);
    expect(next.townWallHp).toBe(save.townWallHp - 5);
  });

  it("scales building modifiers", () => {
    expect(wallHpBonusFromBuildings({ wall: 2 })).toBe(100);
    expect(playerDamageMult({ blacksmith: 1 })).toBeCloseTo(1.1);
  });

  it("prepares defense after a lost night at 0 wall or player hp", () => {
    const save = createNewSave();
    save.townWallHp = 0;
    save.player.hp = 0;
    const ready = prepareDefenseNight(save);
    expect(ready.townWallHp).toBe(save.townWallHpMax);
    expect(ready.player.hp).toBe(save.player.hpMax);
    expect(ready.night).toBe(1);
  });

  it("applyEndlessRunExit updates hp without gold or night", () => {
    const save = createNewSave();
    save.gold = 12;
    save.night = 3;
    const next = applyEndlessRunExit(save, 88, 45);
    expect(next.gold).toBe(12);
    expect(next.night).toBe(3);
    expect(next.townWallHp).toBe(88);
    expect(next.player.hp).toBe(45);
  });

  it("keeps partial wall hp when retrying after player death", () => {
    const save = createNewSave();
    save.townWallHp = 72;
    save.player.hp = 1;
    const ready = prepareDefenseNight(save);
    expect(ready.townWallHp).toBe(72);
    expect(ready.player.hp).toBe(1);
  });
});

describe("GameState save persistence", () => {
  it("returns a new save when storage is missing, invalid, or corrupt", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadSave().night).toBe(1);

    const items = new Map<string, string>();
    const key = saveStorageKey();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => {
        items.set(k, v);
      },
      removeItem: (k: string) => {
        items.delete(k);
      },
    });
    items.set(
      key,
      JSON.stringify({ version: SAVE_VERSION + 1, save: createNewSave() }),
    );
    expect(loadSave().gold).toBe(0);
    items.set(key, "{not-json");
    expect(loadSave().night).toBe(1);
    items.set(key, JSON.stringify({ version: SAVE_VERSION }));
    expect(loadSave().night).toBe(1);
    vi.unstubAllGlobals();
  });

  it("migrates a 3-slot legacy bar, remapping old spell ids", () => {
    const key = saveStorageKey();
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => {
        items.set(k, v);
      },
      removeItem: (k: string) => {
        items.delete(k);
      },
    });
    const base = createNewSave();
    items.set(
      key,
      JSON.stringify({
        version: SAVE_VERSION,
        save: {
          ...base,
          spellBar: {
            slots: ["nova", "fireball", "heal"],
            autoCastSpellIds: [],
          },
        },
      }),
    );
    const loaded = loadSave();
    expect(loaded.spellBar.slots[0]).toBe("fire_nova");
    expect(loaded.spellBar.slots[1]).toBe("fire_bolt");
    expect(loaded.spellBar.slots[2]).toBe("heal");
    expect(loaded.spellBar.slots).toHaveLength(SPELL_BAR.slotCount);
    persistSave(loaded);
    expect(items.get(key)).toContain("fire_nova");
    vi.unstubAllGlobals();
  });

  it("clears the save and reloads with a fresh query", () => {
    const items = new Map<string, string>([[saveStorageKey(), "x"]]);
    const replace = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => {
        items.set(k, v);
      },
      removeItem: (k: string) => {
        items.delete(k);
      },
    });
    vi.stubGlobal("window", {
      location: { href: "https://example.com/game", replace },
    });
    resetSaveAndReload();
    expect(items.size).toBe(0);
    expect(replace).toHaveBeenCalledOnce();
    expect(String(replace.mock.calls[0]![0])).toContain("fresh=");
    vi.unstubAllGlobals();

    // No window: just clear storage (or no-op if storage is also missing).
    vi.stubGlobal("localStorage", undefined);
    vi.stubGlobal("window", undefined);
    expect(() => resetSaveAndReload()).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("GameState bar length", () => {
  it("trims a spell bar that has more slots than the current bar allows", () => {
    const key = saveStorageKey();
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => {
        items.set(k, v);
      },
      removeItem: (k: string) => {
        items.delete(k);
      },
    });
    const save = createNewSave();
    const oversized = {
      ...save,
      spellBar: {
        ...save.spellBar,
        slots: [...save.spellBar.slots, "fire_bolt", "heal", "meteor"],
      },
    };
    items.set(key, JSON.stringify({ version: SAVE_VERSION, save: oversized }));
    const loaded = loadSave();
    expect(loaded.spellBar.slots).toHaveLength(SPELL_BAR.slotCount);
    vi.unstubAllGlobals();
  });
});
