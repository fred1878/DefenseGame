import { describe, expect, it } from "vitest";
import saveV1 from "./fixtures/save-v1.json";
import saveV2 from "./fixtures/save-v2.json";
import { migrateRawSave, SAVE_MIGRATIONS } from "./migrations";
import { SAVE_VERSION } from "./saveTypes";

describe("save migrations", () => {
  it("has a step from every historical version up to the current one", () => {
    for (let v = 1; v < SAVE_VERSION; v++) {
      expect(SAVE_MIGRATIONS[v], `missing migration from v${v}`).toBeTypeOf(
        "function",
      );
    }
  });

  it("v1 → v2 drops player.weaponId and keeps everything else", () => {
    const r = migrateRawSave(1, saveV1.save);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migratedFrom).toBe(1);
    expect(r.save.player).toEqual({ hp: 80, hpMax: 100 });
    expect(r.save.night).toBe(5);
    expect(r.save.flags).toEqual(["met_blacksmith"]);
    // pure: the input is untouched
    expect(saveV1.save.player.weaponId).toBe("sword");
  });

  it("passes a current-version save through unchanged", () => {
    const r = migrateRawSave(SAVE_VERSION, saveV2.save);
    expect(r).toEqual({ ok: true, save: saveV2.save, migratedFrom: null });
  });

  it("rejects unknown, newer and unmigratable versions", () => {
    expect(migrateRawSave(undefined, {})).toEqual({
      ok: false,
      reason: "unknownVersion",
    });
    expect(migrateRawSave(0, {})).toMatchObject({ reason: "unknownVersion" });
    expect(migrateRawSave(1.5, {})).toMatchObject({ reason: "unknownVersion" });
    expect(migrateRawSave(SAVE_VERSION + 1, {})).toMatchObject({
      reason: "newerVersion",
    });
    expect(migrateRawSave(1, {}, {}, 3)).toMatchObject({
      reason: "noMigration",
    });
  });

  it("chains steps in order", () => {
    const r = migrateRawSave(
      1,
      { night: 1, gold: 0, log: [] },
      {
        1: (s) => ({ ...s, log: [...(s.log as string[]), "1→2"] }),
        2: (s) => ({ ...s, log: [...(s.log as string[]), "2→3"] }),
      },
      3,
    );
    expect(r.ok && r.save.log).toEqual(["1→2", "2→3"]);
  });

  it("handles a v1 save without a player block", () => {
    const r = migrateRawSave(1, { night: 2, gold: 3 });
    expect(r.ok && r.save).toEqual({ night: 2, gold: 3 });
  });
});
