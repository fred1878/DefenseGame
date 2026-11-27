import type Phaser from "phaser";
import type { DataStore } from "../../core/data/DataStore";
import { recordCombatDamage } from "../../e2e/combatTally";
import { publishE2E } from "../../e2e/e2eGlobal";
import { isE2EEnabled } from "../../e2e/e2eMode";
import type { DefenseTopHud } from "../../ui/hud/defenseTopHud";
import type { TouchButtonHandle } from "../../ui/touch/touchButton";
import type { DamageNumberFx } from "./DamageNumberFx";
import type { DefenseEnemySpawnerHost } from "./DefenseEnemySpawner";
import type { DefenseNightEndShared } from "./DefenseNightEnd";
import type { DefenseRunState } from "./DefenseRunState";
import type { DefenseSceneE2eHost } from "./DefenseSceneE2EHost";

/*
 * Adapters binding DefenseScene's run state and HUD to the night-end and
 * enemy-spawner helpers (kept out of the scene class so it stays wiring-only).
 */

export type DefenseNightEndHost = {
  scene: Phaser.Scene;
  run: DefenseRunState;
  hudText: Phaser.GameObjects.Text;
  topHud: DefenseTopHud;
  registerUiDraw: (go: Phaser.GameObjects.GameObject) => void;
  onReturnToTown: () => void;
};

/** Night-end context for `DefenseNightEnd` / run modes. */
export function defenseNightEndContext(
  h: DefenseNightEndHost,
): DefenseNightEndShared {
  const { run } = h;
  return {
    scene: h.scene,
    registry: h.scene.registry,
    save: run.save,
    player: run.player,
    wallHp: run.wallHp,
    hudText: h.hudText,
    safe: run.safe,
    markNightEnded: () => {
      run.nightEnded = true;
      h.topHud.setVisible(false);
    },
    setEndlessSelectionsNull: () => {
      run.endlessSelections = null;
    },
    hideLeaveEndlessBtn: () => {
      if (run.leaveEndlessBtn) {
        run.leaveEndlessBtn.container.setVisible(false);
        run.leaveEndlessBtn.container.disableInteractive();
      }
    },
    registerUiDraw: (go: Phaser.GameObjects.GameObject) => h.registerUiDraw(go),
    setReturnToTownBtn: (btn: TouchButtonHandle | null) => {
      if (run.returnToTownBtn && run.returnToTownBtn !== btn) {
        run.returnToTownBtn.container.destroy();
      }
      run.returnToTownBtn = btn;
    },
    onReturnToTown: h.onReturnToTown,
  };
}

export type DefenseSpawnerHostInput = {
  scene: Phaser.Scene;
  store: DataStore;
  run: DefenseRunState;
  enemyGroup: Phaser.Physics.Arcade.Group;
  damageNumbers: DamageNumberFx;
  registerWorldDraw: (go: Phaser.GameObjects.GameObject) => void;
  onRemovedFromPlay: () => void;
};

/** Spawner host: pooled enemies join the run, report damage, refill endless. */
export function defenseEnemySpawnerHost(
  h: DefenseSpawnerHostInput,
): DefenseEnemySpawnerHost {
  const { run } = h;
  return {
    scene: h.scene,
    dataStore: h.store,
    enemies: run.enemies,
    enemyGroup: h.enemyGroup,
    hooks: {
      onRemovedFromPlay: h.onRemovedFromPlay,
      onFocusEnemy: (id) => run.targeting.setFocusEnemy(id),
    },
    maskWorldObject: (go) => h.registerWorldDraw(go),
    notifyDamaged: (enemy, amount, flavor, source) => {
      if (isE2EEnabled()) recordCombatDamage(flavor, amount, source);
      h.damageNumbers.floatFromSource(
        enemy.damageable.id,
        enemy.sprite,
        amount,
        { flavor },
      );
    },
  };
}

/** E2E mode: publish Defense scene state (with per-frame combat flags from `update`). */
export function publishDefenseE2eState(
  e2e: DefenseSceneE2eHost | null,
  withFlags: boolean,
): void {
  if (!e2e) return;
  publishE2E({
    scene: "Defense",
    ready: true,
    player: e2e.playerPosition(),
    ...(withFlags
      ? {
          flags: {
            attackPhase: e2e.attackPhase(),
            projectileCount: e2e.projectileCount(),
            enemyCount: e2e.enemyCount(),
          },
        }
      : {}),
  });
}
