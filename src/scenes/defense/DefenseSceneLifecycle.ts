import type Phaser from "phaser";
import { destroyArrowRainTelegraph } from "../../combat/ArrowRainTelegraph";
import { SHADOWFORM_MECHANICS } from "../../config/shadowformMechanics";
import { setShadowformRuntimeMults } from "../../config/shadowformRuntime";
import { shadowformActive } from "../../combat/shadowform";
import type { EnemyInstance } from "../../entities/Enemy";
import type { Player } from "../../entities/Player";
import {
  destroyProjectilePool,
  releaseProjectileSprite,
  type EnemyProjectile,
  type PlayerProjectile,
} from "../../entities/Projectile";
import { destroyDefenseEnemyPool } from "./DefenseEnemySpawner";
import { destroyEnemyNameplate } from "../../ui/enemyNameplate";
import {
  blocksBaseLayerInput,
  INPUT_MODALITY,
  isInputModalityActive,
} from "../../input/inputModality";
import { setContainerInputEnabled } from "../../input/setContainerInputEnabled";
import type { TouchButtonHandle } from "../../ui/touchButton";

type Destroyable = { destroy(): void };

/** Scene-owned objects torn down on `DefenseScene` shutdown, in this order. */
export type DefenseSceneDisposables = {
  scene: Phaser.Scene;
  stick?: { destroy(scene: Phaser.Scene): void };
  targetIndicator?: Destroyable;
  groundReticle?: Destroyable;
  clearSpellTelegraphs: () => void;
  castBar?: Destroyable;
  spellBar?: Destroyable;
  hitboxDebug?: Destroyable;
  rangeDebug?: Destroyable;
  pathDebug?: Destroyable;
  touchDebug?: Destroyable;
  fpsOverlay?: Destroyable;
  minimap?: Destroyable;
  returnToTownBtn: TouchButtonHandle | null;
  leaveEndlessBtn: TouchButtonHandle | null;
  debugBtn?: TouchButtonHandle;
  uiCamera?: Destroyable;
  projectiles: PlayerProjectile[];
  enemyProjectiles: EnemyProjectile[];
  enemies: EnemyInstance[];
};

/** Destroy HUD, debug drawers, projectiles and enemies; caller clears its references. */
export function destroyDefenseSceneObjects(d: DefenseSceneDisposables): void {
  d.stick?.destroy(d.scene);
  d.targetIndicator?.destroy();
  d.groundReticle?.destroy();
  d.clearSpellTelegraphs();
  d.castBar?.destroy();
  d.spellBar?.destroy();
  d.hitboxDebug?.destroy();
  d.rangeDebug?.destroy();
  d.pathDebug?.destroy();
  d.touchDebug?.destroy();
  d.fpsOverlay?.destroy();
  d.minimap?.destroy();
  d.returnToTownBtn?.container.destroy();
  d.leaveEndlessBtn?.container.destroy();
  d.debugBtn?.container.destroy();
  d.uiCamera?.destroy();
  for (const p of d.projectiles) releaseProjectileSprite(d.scene, p.sprite);
  for (const p of d.enemyProjectiles)
    releaseProjectileSprite(d.scene, p.sprite);
  destroyProjectilePool(d.scene);
  for (const e of d.enemies) {
    destroyArrowRainTelegraph(e.arrowRain?.telegraph);
    destroyArrowRainTelegraph(e.lobber?.telegraph);
    e.sprite.destroy();
    destroyEnemyNameplate(e.nameplate);
  }
  destroyDefenseEnemyPool(d.scene);
}

export function syncShadowformPlayerFx(
  player: Player | undefined,
  active: boolean,
): void {
  const spr = player?.sprite;
  if (!spr) return;
  if (active) {
    spr.setAlpha(0.88);
    spr.setTint(0xb8a8e8);
  } else {
    spr.clearTint();
    spr.setAlpha(1);
  }
}

/** Apply shadowform aggro / damage-taken mults and the player tint for this frame. */
export function syncShadowformRuntime(
  player: Player | undefined,
  shadowformEndsAt: number,
  nowMs: number,
): void {
  const active = shadowformActive(shadowformEndsAt, nowMs);
  const mechanics = SHADOWFORM_MECHANICS;
  setShadowformRuntimeMults({
    aggroRadiusMult: active ? mechanics.aggroRadiusMult : 1,
    damageTakenMult: active ? mechanics.damageTakenMult : 1,
  });
  syncShadowformPlayerFx(player, active);
}

export type DefenseBaseInputControls = {
  attackButton: Phaser.GameObjects.Container;
  modeToggle: { container: Phaser.GameObjects.Container };
  autoToggle: { container: Phaser.GameObjects.Container };
  leaveEndlessBtn: TouchButtonHandle | null;
  returnToTownBtn: TouchButtonHandle | null;
  debugBtn: TouchButtonHandle | undefined;
};

/** Disable combat chrome while a modal owns input; trim HUD during ground-aim. */
export function syncDefenseBaseInput(
  scene: Phaser.Scene,
  c: DefenseBaseInputControls,
): void {
  const modal = blocksBaseLayerInput(scene);
  const groundAim = isInputModalityActive(
    scene,
    INPUT_MODALITY.defenseGroundAim.id,
  );
  const combatChrome = !modal && !groundAim;
  setContainerInputEnabled(c.attackButton, combatChrome);
  setContainerInputEnabled(c.modeToggle.container, combatChrome);
  setContainerInputEnabled(c.autoToggle.container, combatChrome);
  if (c.leaveEndlessBtn) {
    setContainerInputEnabled(c.leaveEndlessBtn.container, !modal);
  }
  if (c.returnToTownBtn) {
    setContainerInputEnabled(c.returnToTownBtn.container, !modal);
  }
  if (c.debugBtn) {
    setContainerInputEnabled(c.debugBtn.container, !modal);
  }
}
