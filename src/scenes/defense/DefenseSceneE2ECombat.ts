import Phaser from "phaser";
import { spellById } from "../../content/spells";
import { applyDamage, MELEE_HIT_FLAVOR } from "../../combat/DamageSystem";
import { setShowHitboxes } from "../../debug/DebugState";
import { showEnemyMeleeSwipe } from "../../combat/MeleeSwipeFx";
import {
  enemyMeleeFxSpec,
  enemyMeleeFxTransform,
} from "../../content/meleeFxAssets";
import { showFlashHealPulseFx } from "../../combat/SpellFlashHealFx";
import { SpellHealChannelFx } from "../../combat/SpellHealChannelFx";
import type { SpellBar } from "../../ui/SpellBar";
import {
  interactiveObjectScreenRect,
  isTouchButtonVisuallyPressed,
} from "../../ui/touchButton";
import type { DefenseSceneE2eDelegate } from "./DefenseSceneE2ETypes";

/** E2E hooks: readiness, input, combat, enemies, night/endless state, tap targets. */

export function defenseSceneE2eIsReady(scene: DefenseSceneE2eDelegate): boolean {
  return Boolean(scene.player?.sprite);
}

export function defenseSceneE2eBottomChromeTextureKey(): string | null {
  return null;
}

export function defenseSceneE2eSetStick(
  scene: DefenseSceneE2eDelegate,
  dx: number,
  dy: number,
): void {
  scene.stick.setE2eOverride(dx, dy);
}

export function defenseSceneE2ePlayerPosition(
  scene: DefenseSceneE2eDelegate,
): { x: number; y: number } {
  return { x: scene.player.sprite.x, y: scene.player.sprite.y };
}

export function defenseSceneE2eAttackPhase(
  scene: DefenseSceneE2eDelegate,
): string {
  return scene.player.attackPhaseNow;
}

export function defenseSceneE2eProjectileCount(
  scene: DefenseSceneE2eDelegate,
): number {
  return scene.projectiles.filter((p) => p.sprite.active).length;
}

export function defenseSceneE2eEnemyCount(
  scene: DefenseSceneE2eDelegate,
): number {
  return scene.enemies.filter((e) => e.damageable.alive).length;
}

export function defenseSceneE2eWallHp(scene: DefenseSceneE2eDelegate): number {
  return Math.max(0, Math.floor(scene.wallHp));
}

export function defenseSceneE2eTapMelee(scene: DefenseSceneE2eDelegate): void {
  scene.player.setAttackMode("melee");
  scene.refreshModeToggle("melee");
  if (scene.enemies.length === 0) {
    scene.spawnEnemyAt(
      scene.player.sprite.x + 48,
      scene.player.sprite.y,
      undefined,
      "grunt",
      1,
    );
  }
  scene.player.faceToward(scene.player.sprite.x + 48, scene.player.sprite.y);
  scene.player.tryStartAttack();
}

export function defenseSceneE2eTapRanged(scene: DefenseSceneE2eDelegate): void {
  scene.player.setAttackMode("ranged");
  scene.refreshModeToggle("ranged");
  if (scene.enemies.length === 0) {
    scene.spawnEnemyAt(
      scene.player.sprite.x + 80,
      scene.player.sprite.y,
      undefined,
      "grunt",
      1,
    );
  }
  const e = scene.enemies[0];
  if (e) scene.player.faceToward(e.sprite.x, e.sprite.y);
  scene.player.tryStartAttack();
}

export function defenseSceneE2eCastSpellSlot(
  scene: DefenseSceneE2eDelegate,
  slot: number,
): Promise<void> {
  const id = scene.save.spellBar.slots[slot];
  if (!id) return Promise.resolve();
  scene.onSpellCastRequest(id);
  const def = spellById(id);
  if (!def || def.channelMs <= 0) return Promise.resolve();
  const waitMs = def.channelMs + 120;
  return new Promise((resolve) => {
    scene.time.delayedCall(waitMs, () => resolve());
  });
}

export function defenseSceneE2eSpawnEnemy(
  scene: DefenseSceneE2eDelegate,
  offX = 48,
  offY = 0,
): void {
  scene.spawnEnemyAt(
    scene.player.sprite.x + offX,
    scene.player.sprite.y + offY,
    undefined,
    "grunt",
    5,
  );
}

export function defenseSceneE2eDamagePlayer(
  scene: DefenseSceneE2eDelegate,
  amount: number,
): void {
  if (amount <= 0 || scene.endlessInfiniteHp) return;
  applyDamage(scene.player.damageable, amount, MELEE_HIT_FLAVOR);
  if (scene.player.damageable.hp <= 0) {
    scene.player.damageable.alive = false;
    if (scene.isEndlessMode()) {
      scene.endEndlessRun("player");
    } else {
      scene.endNight(false);
    }
  }
}

export function defenseSceneE2eIsEndlessMode(
  scene: DefenseSceneE2eDelegate,
): boolean {
  return scene.isEndlessMode();
}

export function defenseSceneE2eEndlessEnemyId(
  scene: DefenseSceneE2eDelegate,
): string | null {
  return scene.endlessSelections?.[0]?.enemyId ?? null;
}

export function defenseSceneE2eEndlessEnemyIds(
  scene: DefenseSceneE2eDelegate,
): string[] {
  return (scene.endlessSelections ?? []).map((s) => s.enemyId);
}

export function defenseSceneE2eKillAllEnemies(
  scene: DefenseSceneE2eDelegate,
): void {
  for (const e of scene.enemies) {
    if (e.damageable.alive) {
      e.damageable.alive = false;
      e.damageable.onDeath?.();
    }
  }
  scene.enemies.length = 0;
}

export function defenseSceneE2eSetSpawnPlanComplete(
  scene: DefenseSceneE2eDelegate,
): void {
  scene.spawnPlanComplete = true;
}

export function defenseSceneE2eForceWinNight(
  scene: DefenseSceneE2eDelegate,
): void {
  defenseSceneE2eKillAllEnemies(scene);
  scene.spawnPlanComplete = true;
  const living = scene.enemies.filter((e) => e.damageable.alive).length;
  if (living === 0 && !scene.nightEnded) {
    scene.endNight(true);
  }
}

export function defenseSceneE2eSetManualReturn(
  scene: DefenseSceneE2eDelegate,
  on: boolean,
): void {
  scene.registry.set("e2eManualReturn", on);
}

export function defenseSceneE2eNightEnded(
  scene: DefenseSceneE2eDelegate,
): boolean {
  return scene.nightEnded;
}

export function defenseSceneE2eHasReturnButton(
  scene: DefenseSceneE2eDelegate,
): boolean {
  return scene.returnToTownBtn !== null;
}

export function defenseSceneE2eHasLeaveEndlessButton(
  scene: DefenseSceneE2eDelegate,
): boolean {
  return (
    scene.leaveEndlessBtn !== null &&
    scene.leaveEndlessBtn.container.visible &&
    !scene.nightEnded
  );
}

export function defenseSceneE2eSimulateScreenTap(
  scene: DefenseSceneE2eDelegate,
  x: number,
  y: number,
): void {
  const pointer = scene.input.pointer1;
  pointer.x = x;
  pointer.y = y;
  pointer.downTime = performance.now();
  pointer.isDown = true;
  scene.input.emit("pointerdown", pointer, []);
  pointer.isDown = false;
  pointer.upTime = performance.now();
  scene.input.emit("pointerup", pointer, []);
  scene.onScreenTap(pointer);
}

export function defenseSceneE2eGetUiTapTargets(
  scene: DefenseSceneE2eDelegate,
): Record<string, { x: number; y: number }> {
  const centerOf = (
    obj: Phaser.GameObjects.GameObject,
  ): { x: number; y: number } | null => {
    const r = interactiveObjectScreenRect(obj);
    if (!r) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const out: Record<string, { x: number; y: number }> = {};
  const atk = centerOf(scene.attackButton);
  if (atk) out["combat-atk"] = atk;
  const mode = centerOf(scene.modeToggle.container);
  if (mode) out["combat-mode"] = mode;
  const auto = centerOf(scene.autoToggle.container);
  if (auto) out["combat-auto"] = auto;
  for (const slot of scene.spellBar.e2eSlotTapCenters()) {
    out[`spell-slot-${slot.index}`] = { x: slot.x, y: slot.y };
  }
  const dbg = centerOf(scene.debugBtn.container);
  if (dbg) out["defense-debug"] = dbg;
  if (scene.returnToTownBtn) {
    const ret = centerOf(scene.returnToTownBtn.container);
    if (ret) out["defense-return-to-town"] = ret;
  }
  if (scene.leaveEndlessBtn?.container.visible) {
    const leave = centerOf(scene.leaveEndlessBtn.container);
    if (leave) out["defense-leave-endless"] = leave;
  }
  return out;
}

export function defenseSceneE2eGetSpellSlotHitRects(
  scene: DefenseSceneE2eDelegate,
): ReturnType<SpellBar["e2eSlotHitRects"]> {
  return scene.spellBar.e2eSlotHitRects();
}

export function defenseSceneE2eAutoAttackEnabled(
  scene: DefenseSceneE2eDelegate,
): boolean {
  return scene.autoAttackEnabled;
}

export function defenseSceneE2eIsTouchButtonPressed(
  scene: DefenseSceneE2eDelegate,
  testId: string,
): boolean {
  const map: Record<string, Phaser.GameObjects.Container | undefined> = {
    "combat-atk": scene.attackButton,
    "combat-mode": scene.modeToggle.container,
    "combat-auto": scene.autoToggle.container,
  };
  const direct = map[testId];
  if (direct) return isTouchButtonVisuallyPressed(direct);
  if (testId === "defense-return-to-town" && scene.returnToTownBtn) {
    return isTouchButtonVisuallyPressed(scene.returnToTownBtn.container);
  }
  if (testId === "defense-leave-endless" && scene.leaveEndlessBtn) {
    return isTouchButtonVisuallyPressed(scene.leaveEndlessBtn.container);
  }
  return false;
}

export function defenseSceneE2eIsEndlessInfiniteHp(
  scene: DefenseSceneE2eDelegate,
): boolean {
  return scene.endlessInfiniteHp;
}

export function defenseSceneE2ePlayerHp(scene: DefenseSceneE2eDelegate): number {
  return Math.floor(scene.player.damageable.hp);
}

/** Playwright: targeting must see respawned endless enemies after dead culls. */
export function defenseSceneE2eCanFocusFirstLivingEnemy(
  scene: DefenseSceneE2eDelegate,
): boolean {
  const e = scene.enemies.find((entry) => entry.damageable.alive);
  if (!e) return false;
  const pick = scene.targeting.findEnemyNearWorldPoint(e.sprite.x, e.sprite.y);
  return pick?.id === e.id;
}

export function defenseSceneE2eDamageFirstLivingEnemy(
  scene: DefenseSceneE2eDelegate,
  amount: number,
): void {
  const e = scene.enemies.find((entry) => entry.damageable.alive);
  if (!e) return;
  applyDamage(e.damageable, amount, MELEE_HIT_FLAVOR);
}

/** E2E: trigger holy heal VFX at the player for before/after capture compares. */
export function defenseSceneE2ePreviewHolyFx(
  scene: DefenseSceneE2eDelegate,
  kind: "flash" | "channel",
): void {
  defenseSceneE2eKillAllEnemies(scene);
  const px = scene.player.sprite.x;
  const py = scene.player.sprite.y;
  scene.cameras.main.centerOn(px, py);
  setShowHitboxes(scene.registry, false);
  if (kind === "flash") {
    showFlashHealPulseFx(scene, px, py, (go) => scene.registerWorldDraw(go));
    return;
  }
  scene.healChannelFx?.destroy();
  scene.healChannelFx = new SpellHealChannelFx(scene);
  scene.healChannelFx.start(px, py, (go) => scene.registerWorldDraw(go));
}

export type EnemyMeleeFxShowcaseResult = {
  facingRad: number;
  spriteRotation: number;
  flipX: boolean;
  offX: number;
  side: "L" | "R";
};

function meleeFacingTowardPlayer(
  ex: number,
  ey: number,
  px: number,
  py: number,
): number {
  return Math.atan2(py - ey, px - ex);
}

/** E2E: spawn at offX, sync combat facing, play one melee swipe toward player. */
export function defenseSceneE2eShowcaseEnemyMeleeSwipe(
  scene: DefenseSceneE2eDelegate,
  enemyDefId: string,
  offX: number,
): EnemyMeleeFxShowcaseResult {
  defenseSceneE2eKillAllEnemies(scene);
  scene.spawnPlanComplete = false;
  const px = scene.player.sprite.x;
  const py = scene.player.sprite.y;
  scene.cameras.main.centerOn(px, py);
  setShowHitboxes(scene.registry, false);
  const ex = px + offX;
  const ey = py;
  scene.spawnEnemyAt(ex, ey, undefined, enemyDefId, 9999);
  const facingRad = meleeFacingTowardPlayer(ex, ey, px, py);
  const enemy = scene.enemies.find(
    (entry) => entry.defId === enemyDefId && entry.damageable.alive,
  );
  if (enemy) {
    enemy.combat.facing = facingRad;
    enemy.sprite.setPosition(ex, ey);
  }
  const spec = enemyMeleeFxSpec(enemyDefId);
  const pose = spec
    ? enemyMeleeFxTransform(facingRad, spec)
    : { rotation: facingRad + Math.PI, flipX: false };
  const spriteRotation = pose.rotation;
  const side: "L" | "R" = offX >= 0 ? "R" : "L";
  const label = scene.add.text(ex, ey - 48, side, {
    fontFamily: "monospace",
    fontSize: "28px",
    color: "#ffee00",
    stroke: "#000000",
    strokeThickness: 4,
  });
  label.setDepth(10_000);
  label.setOrigin(0.5, 0.5);
  scene.time.delayedCall(2200, () => label.destroy());
  const activeMs = enemy?.combatTuning.melee?.activeMs ?? 220;
  showEnemyMeleeSwipe(scene, enemyDefId, ex, ey, facingRad, undefined, activeMs);
  return { facingRad, spriteRotation, flipX: pose.flipX, offX, side };
}

/** E2E: spawn one enemy and play its melee swipe FX toward the player. */
export function defenseSceneE2ePreviewEnemyMeleeFx(
  scene: DefenseSceneE2eDelegate,
  enemyDefId: string,
  offX = 52,
): EnemyMeleeFxShowcaseResult {
  return defenseSceneE2eShowcaseEnemyMeleeSwipe(scene, enemyDefId, offX);
}
