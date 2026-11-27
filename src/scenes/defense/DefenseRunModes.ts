import type { DataStore } from "../../core/DataStore";
import type { CampaignNightLossReason } from "../../systems/nightEndMessaging";
import { endlessHudHeader } from "./DefenseEndlessSpawn";
import {
  type DefenseNightEndShared,
  runDefenseCampaignNightEnd,
  runDefenseEndlessNightEnd,
  runDefenseSimulatedNightEnd,
} from "./DefenseNightEnd";
import type { DefenseRunState } from "./DefenseRunState";

export type DefenseRunModeKind = "campaign" | "endless" | "wavePlanner";

export type DefenseRunModeContext = {
  run: DefenseRunState;
  store: DataStore;
  nightEnd: () => DefenseNightEndShared;
};

/**
 * Per-mode behaviour of a defense run (campaign night, endless training,
 * wave planner). DefenseScene picks one at `create()` and delegates instead of
 * branching on `isEndlessMode()` / `isWavePlannerMode()`.
 */
export type DefenseRunModeStrategy = {
  readonly kind: DefenseRunModeKind;
  hudHeader(ctx: DefenseRunModeContext): string;
  /** Run won/lost by the normal rules (or an E2E force-win). */
  endNight(
    ctx: DefenseRunModeContext,
    won: boolean,
    lossReason?: CampaignNightLossReason,
  ): void;
  /** HUD "leave" button. */
  leave(ctx: DefenseRunModeContext): void;
};

function campaignEndNight(
  ctx: DefenseRunModeContext,
  won: boolean,
  lossReason?: CampaignNightLossReason,
): void {
  const { run } = ctx;
  runDefenseCampaignNightEnd(ctx.nightEnd(), {
    won,
    ...(!won && lossReason !== undefined ? { lossReason } : {}),
    wallHp: run.wallHp,
    wallHpStart: run.wallHpStart,
    rewardGold: run.rewardGold,
    save: run.save,
  });
}

function leaveEndless(ctx: DefenseRunModeContext): void {
  runDefenseEndlessNightEnd(ctx.nightEnd(), "quit");
}

const CAMPAIGN: DefenseRunModeStrategy = {
  kind: "campaign",
  hudHeader: (ctx) => `Night ${ctx.run.save.night}`,
  endNight: campaignEndNight,
  leave: leaveEndless,
};

const ENDLESS: DefenseRunModeStrategy = {
  kind: "endless",
  hudHeader: (ctx) => endlessHudHeader(ctx.store, ctx.run.endlessSelections),
  // Endless runs end through `endEndlessRun`; a direct endNight (E2E
  // force-win) keeps the historical campaign path.
  endNight: campaignEndNight,
  leave: leaveEndless,
};

const WAVE_PLANNER: DefenseRunModeStrategy = {
  kind: "wavePlanner",
  hudHeader: () => "Wave planner",
  endNight: (ctx, won) => runDefenseSimulatedNightEnd(ctx.nightEnd(), { won }),
  leave: (ctx) =>
    runDefenseSimulatedNightEnd(ctx.nightEnd(), { won: false, quit: true }),
};

const STRATEGIES: Record<DefenseRunModeKind, DefenseRunModeStrategy> = {
  campaign: CAMPAIGN,
  endless: ENDLESS,
  wavePlanner: WAVE_PLANNER,
};

export function defenseRunModeStrategy(
  kind: DefenseRunModeKind,
): DefenseRunModeStrategy {
  return STRATEGIES[kind];
}
