import { resetShadowformRuntimeMults } from "../../combat/rules/shadowformRuntime";
import { SpellInputQueue } from "../../combat/rules/spellInputQueue";
import { SpellCastController } from "../../combat/rules/SpellCastController";
import { EnemySpellStatusMap } from "../../combat/rules/enemySpellStatus";
import type { DefenseRunState } from "./DefenseRunState";
import { syncShadowformPlayerFx } from "./DefenseSceneLifecycle";

/**
 * Phaser reuses scene instances: clear per-night state when a new defense run
 * starts (`DefenseScene.create`).
 */
export function resetDefenseRun(
  run: DefenseRunState,
  services: {
    combat: { resetForNewRun(): void };
    groundAim: { resetForNewRun(): void };
  },
): void {
  run.nightEnded = false;
  run.spawnPlanComplete = false;
  run.returnToTownBtn = null;
  run.enemies = [];
  run.projectiles = [];
  run.enemyProjectiles = [];
  run.projectileSerial = 0;
  run.enemyPathGoals.clear();
  run.targeting?.resetForNewRun();
  run.focusTapFlash = null;
  services.combat.resetForNewRun();
  run.autoAttackEnabled = true;
  run.playerInvulnMs = 0;
  run.spellCaster = new SpellCastController();
  run.spellInputQueue = new SpellInputQueue();
  run.enemySpellStatus = new EnemySpellStatusMap();
  run.enemyIceRootFx.reset();
  run.enemyIceStunFx.reset();
  run.iceCastWindupFx?.stop();
  run.iceCastWindupFx = null;
  run.spellChannelArea = null;
  run.spellGroundZones = [];
  run.pendingGroundCast = null;
  run.groundAim = null;
  services.groundAim.resetForNewRun();
  run.shadowformEndsAt = 0;
  resetShadowformRuntimeMults();
  syncShadowformPlayerFx(run.player, false);
  for (const wall of run.iceWallExpires) wall.sprite.destroy();
  run.iceWallExpires = [];
  run.endlessSelections = null;
  run.wavePlannerMode = false;
  run.leaveEndlessBtn = null;
  run.endlessInfiniteHp = false;
}
