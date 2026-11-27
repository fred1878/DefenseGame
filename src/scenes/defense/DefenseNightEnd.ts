import type Phaser from "phaser";
import { applyEndlessRunExit, persistSave } from "../../core/GameState";
import { clearDefenseRunMode } from "../../core/defenseRunMode";
import type { SaveGame } from "../../core/saveTypes";
import { isE2EEnabled } from "../../e2e/e2eMode";
import { publishE2E } from "../../e2e/e2eGlobal";
import type { Player } from "../../entities/Player";
import { createTouchButton } from "../../ui/touchButton";
import type { TouchButtonHandle } from "../../ui/touchButton";
import { nightReturnButtonPosition } from "../../ui/screenLayout";
import { scaleUiX } from "../../core/displayScale";
import type { SafeInsets } from "../../ui/screenLayout";
import { playCoinDeltaSfx } from "../../audio/coinEconomySfx";
import { evaluateEndlessEnd, evaluateNightEnd } from "../defenseNightLogic";
import { getGearCatalog } from "../../gear/gearCatalog";
import { rollNightDrops } from "../../gear/loot";
import { resolveCampaignNightEnd } from "../../gear/nightLootSummary";
import { createRng, randomSeed } from "../../gear/rng";
import { NightLootSummaryPanel } from "../../ui/NightLootSummaryPanel";
import type { CampaignNightLossReason } from "./nightEndMessaging";
import {
  simulatedNightEndHeadline,
  simulatedNightEndHudLines,
  trainingEndHeadline,
  trainingEndHudLines,
} from "./nightEndMessaging";

/** Run after the current pointer/input handler — scene timers do not run while paused. */
export function scheduleAfterPointerHandler(
  scene: Phaser.Scene,
  fn: () => void,
): void {
  if (scene.sys?.isActive()) {
    scene.time.delayedCall(0, fn);
    return;
  }
  scene.sys.game.events.once("poststep", fn);
}

export function transitionDefenseToTown(scene: Phaser.Scene): void {
  clearDefenseRunMode(scene.registry);
  // Defer scene stop/start so we are not inside a pointer/shutdown handler (see #169).
  const go = () => {
    const debugMenu = scene.scene.get("DebugMenu");
    if (debugMenu?.scene.isActive()) {
      scene.scene.stop("DebugMenu");
    }
    const key = scene.scene.key;
    if (key !== "Defense") return;
    if (!scene.scene.isActive(key) && !scene.scene.isPaused(key)) return;
    scene.scene.start("Town");
  };
  scheduleAfterPointerHandler(scene, go);
}

type DefenseNightEndUi = {
  scene: Phaser.Scene;
  hudText: Phaser.GameObjects.Text;
  safe: SafeInsets;
  registerUiDraw: (go: Phaser.GameObjects.GameObject) => void;
  setReturnToTownBtn: (btn: TouchButtonHandle | null) => void;
  onReturnToTown: () => void;
};

type DefenseNightEndShared = DefenseNightEndUi & {
  registry: Phaser.Data.DataManager;
  save: SaveGame;
  player: Player;
  wallHp: number;
  markNightEnded: () => void;
  setEndlessSelectionsNull: () => void;
  hideLeaveEndlessBtn: () => void;
};

/** Endless / wave-planner exit: wall + HP carry over, no gold or night advance. */
function persistRunExit(ctx: DefenseNightEndShared): SaveGame {
  ctx.markNightEnded();
  ctx.hideLeaveEndlessBtn();

  const survivedHp = Math.max(0, Math.floor(ctx.player.damageable.hp));
  const finalWallHp = Math.max(0, ctx.wallHp);
  const next = applyEndlessRunExit(ctx.save, finalWallHp, survivedHp);
  ctx.save.player.hp = next.player.hp;
  persistSave(next);
  ctx.registry.set("save", next);
  clearDefenseRunMode(ctx.registry);
  return next;
}

/** Under e2e (without manual return) go straight back to town; true when handled. */
function e2eAutoReturnToTown(ctx: DefenseNightEndShared): boolean {
  if (!isE2EEnabled() || ctx.registry.get("e2eManualReturn")) return false;
  transitionDefenseToTown(ctx.scene);
  publishE2E({ scene: "Town", ready: true, player: null });
  return true;
}

/** HUD banner + floating "Return to town" button for non-campaign run ends. */
function showRunExitBanner(
  ctx: DefenseNightEndShared,
  next: SaveGame,
  headline: string,
  [scopeLine, economyLine]: readonly [string, string],
  color: string,
): void {
  ctx.hudText.setText(
    [
      headline,
      `${scopeLine} · ${economyLine}`,
      `Wall ${next.townWallHp} HP · HP ${next.player.hp}/${next.player.hpMax}`,
    ].join("\n"),
  );
  ctx.hudText.setColor(color);

  const btn = nightReturnButtonPosition(ctx.scene, ctx.safe);
  const returnBtn = createTouchButton(
    ctx.scene,
    btn.x,
    btn.y,
    "Return to town",
    ctx.onReturnToTown,
    {
      width: btn.width,
      height: btn.height,
      depth: 260,
      fontSize: `${scaleUiX(14)}px`,
      fillColor: 0x15803d,
      strokeColor: 0x4ade80,
    },
  );
  returnBtn.container.setData("testid", "defense-return-to-town");
  ctx.registerUiDraw(returnBtn.container);
  ctx.setReturnToTownBtn(returnBtn);
}

/** Simulated / custom wave — wall rules, no gold or night advance. */
export function runDefenseSimulatedNightEnd(
  ctx: DefenseNightEndShared,
  input: { won: boolean; quit?: boolean },
): void {
  const next = persistRunExit(ctx);
  if (e2eAutoReturnToTown(ctx)) return;
  showRunExitBanner(
    ctx,
    next,
    simulatedNightEndHeadline(input.won, input.quit === true),
    simulatedNightEndHudLines(),
    input.won ? "#a1a1aa" : "#fca5a5",
  );
}

export function runDefenseEndlessNightEnd(
  ctx: DefenseNightEndShared,
  reason: "quit" | "player" | "wall",
): void {
  const next = persistRunExit(ctx);
  ctx.setEndlessSelectionsNull();
  if (e2eAutoReturnToTown(ctx)) return;
  showRunExitBanner(
    ctx,
    next,
    trainingEndHeadline(reason),
    trainingEndHudLines(reason),
    reason === "quit" ? "#a1a1aa" : "#fca5a5",
  );
}

export type DefenseCampaignNightEndInput = {
  won: boolean;
  lossReason?: CampaignNightLossReason;
  wallHp: number;
  wallHpStart: number;
  rewardGold: number;
  save: SaveGame;
};

export function runDefenseCampaignNightEnd(
  ctx: DefenseNightEndShared,
  input: DefenseCampaignNightEndInput,
): void {
  ctx.markNightEnded();
  clearDefenseRunMode(ctx.registry);

  const catalog = getGearCatalog();
  const resolved = resolveCampaignNightEnd({
    won: input.won,
    ...(input.lossReason !== undefined ? { lossReason: input.lossReason } : {}),
    wallHp: input.wallHp,
    wallHpStart: input.wallHpStart,
    rewardGold: input.rewardGold,
    save: input.save,
    drops: rollNightDrops(
      catalog,
      input.won,
      input.save.night,
      // Fixed seed under e2e so the night-end screenshot is stable.
      createRng(isE2EEnabled() ? 1000 + input.save.night : randomSeed()),
    ),
    catalog,
  });
  const goldBefore = input.save.gold;
  const next = resolved.save;
  if (resolved.result.goldEarned > 0 || resolved.soldGold > 0) {
    playCoinDeltaSfx(ctx.scene, goldBefore, next.gold);
  }
  const survivedHp = Math.max(0, Math.floor(ctx.player.damageable.hp));
  ctx.save.player.hp = survivedHp;
  next.player.hp = Math.min(next.player.hpMax, Math.max(1, survivedHp));
  persistSave(next);
  ctx.registry.set("save", next);

  if (e2eAutoReturnToTown(ctx)) return;

  // The summary panel replaces the old HUD banner + floating return button.
  ctx.hudText.setVisible(false);
  const panel = new NightLootSummaryPanel(
    ctx.scene,
    resolved.summary,
    ctx.onReturnToTown,
  );
  ctx.registerUiDraw(panel.root);
  ctx.registerUiDraw(panel.returnBtn.container);
  ctx.setReturnToTownBtn(panel.returnBtn);
  if (isE2EEnabled()) {
    publishE2E({
      flags: { nightEnded: true, hasReturnButton: true },
    });
  }
}

export type DefenseRunEndCheck = {
  endless: boolean;
  nightEnded: boolean;
  wallHp: number;
  playerHp: number;
  infiniteHp: boolean;
  spawnPlanComplete: boolean;
  livingEnemies: number;
  onEndlessEnd: (reason: "player") => void;
  onNightEnd: (won: boolean, lossReason?: CampaignNightLossReason) => void;
};

/** Per-frame end check: endless runs end on player death, campaign nights on win/loss. */
export function checkDefenseRunEnd(input: DefenseRunEndCheck): void {
  if (input.endless) {
    const endlessEnd = evaluateEndlessEnd({
      nightEnded: input.nightEnded,
      playerHp: input.playerHp,
      infiniteHp: input.infiniteHp,
    });
    if (endlessEnd) input.onEndlessEnd(endlessEnd.reason);
    return;
  }
  const nightEnd = evaluateNightEnd({
    nightEnded: input.nightEnded,
    wallHp: input.wallHp,
    playerHp: input.playerHp,
    spawnPlanComplete: input.spawnPlanComplete,
    livingEnemies: input.livingEnemies,
  });
  if (!nightEnd) return;
  if (nightEnd.won) input.onNightEnd(true);
  else input.onNightEnd(false, nightEnd.lossReason);
}
