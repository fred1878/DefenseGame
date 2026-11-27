import { applyEndlessRunExit } from "../core/save/GameState";
import type { SaveGame } from "../core/save/saveTypes";
import {
  type CampaignNightEndResolution,
  type ResolveCampaignNightEndInput,
  resolveCampaignNightEnd,
} from "../gear/nightLootSummary";
import type { CampaignNightLossReason } from "./nightEndMessaging";

export type NightEndEvaluation =
  | false
  | { won: true }
  | { won: false; lossReason: CampaignNightLossReason };

export type EndlessEndEvaluation = false | { reason: "player" };

/**
 * Endless training ends only on player death — no wall objective.
 */
export function evaluateEndlessEnd(input: {
  nightEnded: boolean;
  playerHp: number;
  infiniteHp?: boolean;
}): EndlessEndEvaluation {
  if (input.nightEnded) return false;
  if (input.infiniteHp) return false;
  if (input.playerHp <= 0) return { reason: "player" };
  return false;
}

/** Pure guard for DefenseScene night-end checks (wall / player / clear). */
export function evaluateNightEnd(input: {
  nightEnded: boolean;
  wallHp: number;
  playerHp: number;
  spawnPlanComplete: boolean;
  livingEnemies: number;
}): NightEndEvaluation {
  if (input.nightEnded) return false;
  if (input.wallHp <= 0) return { won: false, lossReason: "wall" };
  if (input.playerHp <= 0) return { won: false, lossReason: "player" };
  if (input.spawnPlanComplete && input.livingEnemies === 0)
    return { won: true };
  return false;
}

/** Player HP left at the end of a run (whole HP, never negative). */
export function survivedPlayerHp(playerHp: number): number {
  return Math.max(0, Math.floor(playerHp));
}

/**
 * Endless / wave-planner exit: wall + HP carry over, no gold or night
 * advance. Pure: returns the save to persist.
 */
export function resolveRunExitSave(
  save: SaveGame,
  wallHp: number,
  playerHp: number,
): SaveGame {
  return applyEndlessRunExit(
    save,
    Math.max(0, wallHp),
    survivedPlayerHp(playerHp),
  );
}

/**
 * Campaign night end: gold, drops and wall damage (`resolveCampaignNightEnd`)
 * plus the HP carried into town (at least 1, at most max HP). Pure: the caller
 * persists `resolution.save` and shows `resolution.summary`.
 */
export function resolveCampaignNightEndSave(
  input: ResolveCampaignNightEndInput & { playerHp: number },
): CampaignNightEndResolution {
  const { playerHp, ...rest } = input;
  const resolved = resolveCampaignNightEnd(rest);
  const hp = survivedPlayerHp(playerHp);
  const next = resolved.save;
  return {
    ...resolved,
    save: {
      ...next,
      player: {
        ...next.player,
        hp: Math.min(next.player.hpMax, Math.max(1, hp)),
      },
    },
  };
}
