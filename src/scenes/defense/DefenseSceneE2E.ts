import Phaser from "phaser";
import {
  DEFENSE_OBSTACLE_PLACEMENTS,
  defenseObstacleSpriteAnchor,
  type AttackMode,
} from "../../config";
import { spellById } from "../../content/spells";
import type { EnemyDef } from "../../core/DataStore";
import type { EndlessRunSelection } from "../../core/defenseRunMode";
import { applyDamage } from "../../combat/DamageSystem";
import { setShowEnemyPaths } from "../../debug/DebugState";
import type { EnemyInstance } from "../../entities/Enemy";
import type { PlayerProjectile } from "../../entities/Projectile";
import { Player } from "../../entities/Player";
import type { VirtualStick } from "../../input/VirtualStick";
import type { SaveGame } from "../../core/saveTypes";
import type { SpellBar } from "../../ui/SpellBar";
import {
  interactiveObjectScreenRect,
  isTouchButtonVisuallyPressed,
} from "../../ui/touchButton";
import type { TouchButtonHandle } from "../../ui/touchButton";
import { scaledDefenseObstacles } from "../../core/worldPixelScale";
import { scaleUiY } from "../../core/displayScale";
import { defenseMinimapLayout } from "../../ui/defenseMinimap";
import {
  combatChromeLayout,
  defensePlayAreaLayout,
  hudTextPosition,
  type SafeInsets,
} from "../../ui/screenLayout";

/**
 * Scene surface required by Playwright / `installE2E` hooks.
 * Intentionally wider than public gameplay API — refactor PR1 (REFACTOR_PLAN).
 */
export type DefenseSceneE2eDelegate = Phaser.Scene & {
  readonly player: Player;
  readonly stick: VirtualStick;
  readonly projectiles: PlayerProjectile[];
  readonly wallHp: number;
  readonly save: SaveGame;
  readonly attackButton: Phaser.GameObjects.Container;
  readonly modeToggle: { container: Phaser.GameObjects.Container };
  readonly autoToggle: { container: Phaser.GameObjects.Container };
  readonly spellBar: SpellBar;
  readonly debugBtn: TouchButtonHandle;
  readonly autoAttackEnabled: boolean;
  spawnPlanComplete: boolean;
  readonly nightEnded: boolean;
  enemies: EnemyInstance[];
  readonly returnToTownBtn: TouchButtonHandle | null;
  readonly leaveEndlessBtn: TouchButtonHandle | null;
  readonly endlessSelections: EndlessRunSelection[] | null;
  readonly obstacleGroup: Phaser.Physics.Arcade.StaticGroup;

  spawnEnemyAt(
    x: number,
    y: number,
    def?: EnemyDef,
    defId?: string,
    hpOverride?: number,
  ): void;
  onSpellCastRequest(spellId: string): void;
  refreshModeToggle(mode: AttackMode): void;
  onScreenTap(pointer: Phaser.Input.Pointer): void;
  endNight(won: boolean): void;
  endEndlessRun(reason: "quit" | "player" | "wall"): void;
  isEndlessMode(): boolean;
  readonly endlessInfiniteHp: boolean;
  readonly safe: SafeInsets;
  readonly minimapLayout: ReturnType<typeof defenseMinimapLayout>;
};

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
  applyDamage(scene.player.damageable, amount);
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
    e.damageable.alive = false;
    e.sprite.destroy();
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

export function defenseSceneE2eSetPlayerPosition(
  scene: DefenseSceneE2eDelegate,
  x: number,
  y: number,
): void {
  scene.player.sprite.setPosition(x, y);
  const body = scene.player.sprite.body as Phaser.Physics.Arcade.Body | null;
  body?.reset(x, y);
  // E2E teleports skip follow lerp — tests assert scroll vs position, not easing.
  scene.cameras.main.centerOn(x, y);
}

export function defenseSceneE2eGetDefenseCameraScroll(
  scene: DefenseSceneE2eDelegate,
): { x: number; y: number } {
  return {
    x: scene.cameras.main.scrollX,
    y: scene.cameras.main.scrollY,
  };
}

export function defenseSceneE2eSetShowEnemyPaths(
  scene: DefenseSceneE2eDelegate,
  on: boolean,
): void {
  setShowEnemyPaths(scene.registry, on);
}

export function defenseSceneE2eWorldPointToScreen(
  scene: DefenseSceneE2eDelegate,
  worldX: number,
  worldY: number,
): { x: number; y: number } {
  const cam = scene.cameras.main;
  return {
    x: (worldX - cam.scrollX) * cam.zoom,
    y: (worldY - cam.scrollY) * cam.zoom,
  };
}

export function defenseSceneE2eHudLayoutProbe(scene: DefenseSceneE2eDelegate): {
  playArea: ReturnType<typeof defensePlayAreaLayout>;
  chrome: ReturnType<typeof combatChromeLayout>;
  hudText: { x: number; y: number };
  minimap: ReturnType<typeof defenseMinimapLayout>;
} {
  const playArea = defensePlayAreaLayout(scene, scene.safe);
  const chrome = combatChromeLayout(scene, scene.safe);
  const hud = hudTextPosition(scene.safe);
  return {
    playArea,
    chrome,
    hudText: hud,
    minimap: scene.minimapLayout,
  };
}

function defenseSceneE2eHudBandPixelProbePoints(
  scene: DefenseSceneE2eDelegate,
): {
  topBand: { x: number; y: number };
  bottomBand: { x: number; y: number };
  playArea: { x: number; y: number };
} {
  const probe = defenseSceneE2eHudLayoutProbe(scene);
  return {
    topBand: {
      x: Math.round(scene.scale.width * 0.22),
      y: Math.max(8, Math.round(probe.playArea.topBandBottom * 0.42)),
    },
    bottomBand: {
      x: Math.round(scene.scale.width * 0.5),
      y: Math.round(probe.playArea.bottomBandTop + scaleUiY(36)),
    },
    playArea: {
      x: Math.round(scene.scale.width / 2),
      y: Math.round(probe.playArea.y + probe.playArea.height * 0.55),
    },
  };
}

function readPixelFromSnapshot(
  scene: DefenseSceneE2eDelegate,
  image: HTMLImageElement,
  gameX: number,
  gameY: number,
): { r: number; g: number; b: number; a: number; luminance: number } {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const bufW = image.width;
  const bufH = image.height;
  const bx = Math.min(bufW - 1, Math.max(0, Math.round((gameX / w) * bufW)));
  const by = Math.min(bufH - 1, Math.max(0, Math.round((gameY / h) * bufH)));
  const scratch = document.createElement("canvas");
  scratch.width = bufW;
  scratch.height = bufH;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { r: 0, g: 0, b: 0, a: 0, luminance: 0 };
  }
  ctx.drawImage(image, 0, 0);
  const d = ctx.getImageData(bx, by, 1, 1).data;
  const r = d[0] ?? 0;
  const g = d[1] ?? 0;
  const b = d[2] ?? 0;
  const a = d[3] ?? 0;
  return { r, g, b, a, luminance: (r + g + b) / 3 };
}

export function defenseSceneE2eSampleHudBandPixelsAsync(
  scene: DefenseSceneE2eDelegate,
): Promise<{
  points: {
    topBand: { x: number; y: number };
    bottomBand: { x: number; y: number };
    playArea: { x: number; y: number };
  };
  topBand: { r: number; g: number; b: number; a: number; luminance: number };
  bottomBand: { r: number; g: number; b: number; a: number; luminance: number };
  playArea: { r: number; g: number; b: number; a: number; luminance: number };
}> {
  const points = defenseSceneE2eHudBandPixelProbePoints(scene);
  return new Promise((resolve) => {
    scene.game.renderer.snapshot((image: HTMLImageElement | Phaser.Display.Color) => {
      if (!(image instanceof HTMLImageElement)) {
        const zero = { r: 0, g: 0, b: 0, a: 0, luminance: 0 };
        resolve({
          points,
          topBand: zero,
          bottomBand: zero,
          playArea: zero,
        });
        return;
      }
      resolve({
        points,
        topBand: readPixelFromSnapshot(scene, image, points.topBand.x, points.topBand.y),
        bottomBand: readPixelFromSnapshot(
          scene,
          image,
          points.bottomBand.x,
          points.bottomBand.y,
        ),
        playArea: readPixelFromSnapshot(
          scene,
          image,
          points.playArea.x,
          points.playArea.y,
        ),
      });
    });
  });
}

export function defenseSceneE2eGetObstacleAlignment(
  scene: DefenseSceneE2eDelegate,
): Array<{
  textureKey: string;
  configX: number;
  configY: number;
  configW: number;
  configH: number;
  anchorX: number;
  anchorY: number;
  spriteX: number;
  spriteY: number;
  displayW: number;
  displayH: number;
  bodyW: number;
  bodyH: number;
  bodyCenterX: number;
  bodyCenterY: number;
}> {
  const children = scene.obstacleGroup.getChildren() as Phaser.Physics.Arcade.Image[];
  const scaled = scaledDefenseObstacles(scene.registry);
  return DEFENSE_OBSTACLE_PLACEMENTS.map((placement, i) => {
    const cfg = scaled[i]!;
    const anchor = defenseObstacleSpriteAnchor(placement);
    const img = children[i]!;
    const body = img.body as Phaser.Physics.Arcade.StaticBody;
    return {
      textureKey: placement.textureKey,
      configX: cfg.x,
      configY: cfg.y,
      configW: cfg.w,
      configH: cfg.h,
      anchorX: anchor.x,
      anchorY: anchor.y,
      spriteX: img.x,
      spriteY: img.y,
      displayW: img.displayWidth,
      displayH: img.displayHeight,
      bodyW: body.width,
      bodyH: body.height,
      bodyCenterX: body.center.x,
      bodyCenterY: body.center.y,
    };
  });
}