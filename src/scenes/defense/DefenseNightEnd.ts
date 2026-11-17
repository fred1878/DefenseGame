import Phaser from "phaser";
import {
  applyEndlessRunExit,
  applyNightResult,
  persistSave,
} from "../../core/GameState";
import { clearDefenseRunMode } from "../../core/defenseRunMode";
import type { NightResult, SaveGame } from "../../core/saveTypes";
import { isE2EEnabled } from "../../e2e/e2eMode";
import { publishE2E } from "../../e2e/e2eGlobal";
import { Player } from "../../entities/Player";
import { createTouchButton } from "../../ui/touchButton";
import type { TouchButtonHandle } from "../../ui/touchButton";
import { nightReturnButtonPosition } from "../../ui/screenLayout";
import { scaleUiX } from "../../core/displayScale";
import type { SafeInsets } from "../../ui/screenLayout";

export function transitionDefenseToTown(scene: Phaser.Scene): void {
  if (scene.scene.get("DebugMenu")?.scene.isActive()) {
    scene.scene.stop("DebugMenu");
  }
  clearDefenseRunMode(scene.registry);
  scene.scene.stop();
  scene.scene.start("Town");
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

  const endPenalty = input.won ? 2 : 0;
  const finalWallHp = Math.max(0, input.wallHp - endPenalty);
  const wallDamage = input.wallHpStart - finalWallHp;
  const result: NightResult = {
    won: input.won,
    goldEarned: input.won ? input.rewardGold : Math.floor(input.rewardGold * 0.25),
    wallDamage,
    night: input.save.night,
  };
  const next = applyNightResult(input.save, result);
  const survivedHp = Math.max(0, Math.floor(ctx.player.damageable.hp));
  ctx.save.player.hp = survivedHp;
  next.player.hp = Math.min(next.player.hpMax, Math.max(1, survivedHp));
  next.townWallHp = finalWallHp;
  persistSave(next);
  ctx.registry.set("save", next);

  if (isE2EEnabled() && !ctx.registry.get("e2eManualReturn")) {
    transitionDefenseToTown(ctx.scene);
    publishE2E({ scene: "Town", ready: true, player: null });
    return;
  }

  const headline = input.won ? "Night defended!" : "You fell — night lost";
  ctx.hudText.setText(
    [
      headline,
      `Night ${result.night} · +${result.goldEarned} gold`,
      `Wall damage ${result.wallDamage} · Wall ${next.townWallHp} HP`,
      input.won
        ? "Dawn breaks over the settlement."
        : "Scouts recover what they can.",
    ].join("\n"),
  );
  ctx.hudText.setColor(input.won ? "#fbbf24" : "#fca5a5");

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
  if (isE2EEnabled()) {
    publishE2E({
      flags: { nightEnded: true, hasReturnButton: true },
    });
  }
}