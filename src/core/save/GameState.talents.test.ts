import { describe, expect, it } from "vitest";
import { basePlayerTuning } from "../../config/player";
import { getTalentCatalog } from "../../talents/talentCatalog";
import {
  applyNightResult,
  createNewSave,
  normalizeSave,
  syncPlayerHpMax,
} from "./GameState";
import type { SaveGame } from "./saveTypes";

const tree = getTalentCatalog();
const result = (won: boolean) => ({
  won,
  goldEarned: 0,
  wallDamage: 0,
  night: 1,
  drops: [],
});

describe("GameState talents", () => {
  it("starts a new save with the starting points and nothing learned", () => {
    const save = createNewSave();
    expect(save.talents).toEqual({
      ranks: {},
      earned: tree.config.startingPoints,
    });
  });

  it("awards points for won and lost nights from talents.json", () => {
    const save = createNewSave();
    const won = applyNightResult(save, result(true));
    expect(won.talents.earned).toBe(
      save.talents.earned + tree.config.pointsPerNightWon,
    );
    const lost = applyNightResult(save, result(false));
    expect(lost.talents.earned).toBe(
      save.talents.earned + tree.config.pointsPerNightLost,
    );
  });

  it("credits legacy saves without talents from nights already won", () => {
    const legacy = { ...createNewSave(), night: 5 } as Partial<SaveGame>;
    delete legacy.talents;
    const save = normalizeSave(legacy as SaveGame);
    expect(save.talents.ranks).toEqual({});
    expect(save.talents.earned).toBe(
      tree.config.startingPoints + 4 * tree.config.pointsPerNightWon,
    );
  });

  it("adds Iron Hide max HP to the player", () => {
    const base = createNewSave();
    const hide = tree.branches
      .flatMap((b) => b.tiers.flatMap((t) => t.nodes))
      .find((n) => n.id === "iron_hide")!;
    const hpPerRank = hide.perRank.modifiers
      .filter((m) => m.stat === "maxHp")
      .reduce((a, m) => a + m.value, 0);
    const save = syncPlayerHpMax({
      ...base,
      talents: { ranks: { iron_hide: 2 }, earned: 99 },
    });
    expect(save.player.hpMax).toBe(basePlayerTuning().maxHp + 2 * hpPerRank);
  });
});
