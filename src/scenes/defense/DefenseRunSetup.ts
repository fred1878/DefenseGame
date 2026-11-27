import type Phaser from "phaser";
import { createDefaultAutoCastSpellIds } from "../../content/spellBarAutoCast";
import { createDefaultSpellBarSlots } from "../../content/spells";
import type { DataStore, WaveDef } from "../../core/DataStore";
import type { SaveGame } from "../../core/saveTypes";
import {
  type EndlessRunSelection,
  readDefenseRunMode,
  resolveEndlessRunSelections,
} from "../../core/defenseRunMode";

export type DefenseRunSetup = {
  endless: boolean;
  wavePlanner: boolean;
  endlessSelections: EndlessRunSelection[] | null;
  endlessInfiniteHp: boolean;
  /** Wave to schedule (campaign night or wave planner); undefined for endless. */
  wave: WaveDef | undefined;
  /** Gold paid for winning (0 for endless / wave planner / no wave data). */
  rewardGold: number;
};

/** Resolve run mode (campaign night, endless, wave planner) at `DefenseScene.create`. */
export function resolveDefenseRunSetup(
  registry: Phaser.Data.DataManager,
  store: DataStore,
  night: number,
): DefenseRunSetup {
  const runMode = readDefenseRunMode(registry);
  if (runMode.kind === "endless") {
    return {
      endless: true,
      wavePlanner: false,
      endlessSelections: resolveEndlessRunSelections(runMode.selections),
      endlessInfiniteHp: runMode.infiniteHp === true,
      wave: undefined,
      rewardGold: 0,
    };
  }
  if (runMode.kind === "wavePlanner") {
    return {
      endless: false,
      wavePlanner: true,
      endlessSelections: null,
      endlessInfiniteHp: false,
      wave: { rewardGold: 0, groups: runMode.groups },
      rewardGold: 0,
    };
  }
  const wave = store.getWaveForNight(night);
  return {
    endless: false,
    wavePlanner: false,
    endlessSelections: null,
    endlessInfiniteHp: false,
    wave,
    rewardGold: wave?.rewardGold ?? 0,
  };
}

/** Fill in default spell-bar slots / auto-cast ids on the scene's save copy. */
export function ensureDefenseSaveSpellBar(save: SaveGame): void {
  if (!save.spellBar?.slots?.length) {
    save.spellBar = {
      slots: createDefaultSpellBarSlots(),
      autoCastSpellIds: createDefaultAutoCastSpellIds(),
    };
  }
  if (!save.spellBar.autoCastSpellIds) {
    save.spellBar.autoCastSpellIds = createDefaultAutoCastSpellIds();
  }
}
