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

/** Simulated / custom wave — wall rules, no gold or night advance. */
export function runDefenseSimulatedNightEnd(
  ctx: DefenseNightEndShared,
  input: { won: boolean; quit?: boolean },
): void {
  ctx.markNightEnded();
  ctx.hideLeaveEndlessBtn();

  const survivedHp = Math.max(0, Math.floor(ctx.player.damageable.hp));
  const finalWallHp = Math.max(0, ctx.wallHp);
  const next = applyEndlessRunExit(ctx.save, finalWallHp, survivedHp);
  ctx.save.player.hp = next.player.hp;
  persistSave(next);
  ctx.registry.set("save", next);
  clearDefenseRunMode(ctx.registry);

  if (isE2EEnabled() && !ctx.registry.get("e2eManualReturn")) {
    transitionDefenseToTown(ctx.scene);
    publishE2E({ scene: "Town", ready: true, player: null });
    return;
  }

  const headline = input.quit
    ? "Simulation ended"
    : input.won
      ? "Wave cleared — simulation complete"
      : "Simulation failed";
  ctx.hudText.setText(
    [
      headline,
      "No gold earned · night unchanged",
      `Wall ${next.townWallHp} HP · HP ${next.player.hp}/${next.player.hpMax}`,
    ].join("\n"),
  );
  ctx.hudText.setColor(input.won ? "#a1a1aa" : "#fca5a5");

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

export function runDefenseEndlessNightEnd(
  ctx: DefenseNightEndShared,
  reason: "quit" | "player" | "wall",
): void {
  ctx.markNightEnded();
  ctx.hideLeaveEndlessBtn();

  const survivedHp = Math.max(0, Math.floor(ctx.player.damageable.hp));
  const finalWallHp = Math.max(0, ctx.wallHp);
  const next = applyEndlessRunExit(ctx.save, finalWallHp, survivedHp);
  ctx.save.player.hp = next.player.hp;
  persistSave(next);
  ctx.registry.set("save", next);
  clearDefenseRunMode(ctx.registry);
  ctx.setEndlessSelectionsNull();

  if (isE2EEnabled() && !ctx.registry.get("e2eManualReturn")) {
    transitionDefenseToTown(ctx.scene);
    publishE2E({ scene: "Town", ready: true, player: null });
    return;
  }

  const headline =
    reason === "quit"
      ? "Training ended"
      : reason === "wall"
        ? "Wall breached — training over"
        : "You fell — training over";
  ctx.hudText.setText(
    [
      headline,
      "No gold earned · night unchanged",
      `Wall ${next.townWallHp} HP · HP ${next.player.hp}/${next.player.hpMax}`,
    ].join("\n"),
  );
  ctx.hudText.setColor(reason === "quit" ? "#a1a1aa" : "#fca5a5");

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

export type DefenseCampaignNightEndInput = {
  won: boolean;
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

  if (isE2EEnabled() && !ctx.registry.get("e2eManualReturn")) {
    transitionDefenseToTown(ctx.scene);
    publishE2E({ scene: "Town", ready: true, player: null });
    return;
  }

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
  onNightEnd: (won: boolean) => void;
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
  if (nightEnd) input.onNightEnd(nightEnd.won);
}
