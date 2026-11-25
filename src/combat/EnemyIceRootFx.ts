import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import {
  ICE_FX_ANIM,
  ICE_FX_ROOT_ALPHA,
  ICE_FX_ROOT_DISPLAY_PX,
  ICE_FX_TEXTURE,
  iceFxPackLoaded,
} from "../content/iceFxAssets";
import type { EnemySpellStatusMap } from "./enemySpellStatus";

const DEPTH = DEFENSE_RENDER_DEPTH.enemyCombatFx;

type RootFxEntry = {
  sprite: Phaser.GameObjects.Sprite;
  mode: "active_hold" | "ending";
};

/** Ice VFX 2 Active / Ending on rooted enemies. */
export class EnemyIceRootFxController {
  private readonly entries = new Map<string, RootFxEntry>();
  private prevRooted = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  reset(): void {
    for (const entry of this.entries.values()) {
      entry.sprite.destroy();
    }
    this.entries.clear();
    this.prevRooted.clear();
  }

  tick(
    enemies: Array<{
      id: string;
      sprite: Phaser.Physics.Arcade.Sprite;
    }>,
    status: EnemySpellStatusMap,
    registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
  ): void {
    if (!iceFxPackLoaded(this.scene)) {
      this.reset();
      return;
    }
    const rootedNow = new Set<string>();
    const posById = new Map<string, { x: number; y: number }>();
    for (const e of enemies) {
      if (!e.sprite.active) continue;
      posById.set(e.id, { x: e.sprite.x, y: e.sprite.y });
      if (status.isRooted(e.id)) rootedNow.add(e.id);
    }

    for (const id of rootedNow) {
      if (!this.prevRooted.has(id) && !this.entries.has(id)) {
        this.spawnActive(id, posById.get(id)!, registerWorldDraw);
      }
    }

    for (const id of this.prevRooted) {
      if (!rootedNow.has(id)) {
        const entry = this.entries.get(id);
        if (entry?.mode === "active_hold") {
          this.playEnding(id, posById.get(id), registerWorldDraw);
        }
      }
    }

    this.prevRooted = rootedNow;

    for (const [id, entry] of this.entries) {
      const pos = posById.get(id);
      if (!pos) continue;
      entry.sprite.setPosition(pos.x, pos.y);
    }
  }

  private spawnActive(
    enemyId: string,
    pos: { x: number; y: number },
    registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
  ): void {
    if (!(this.scene.anims?.exists(ICE_FX_ANIM.rootActive) ?? false)) return;
    const sprite = this.scene.add
      .sprite(pos.x, pos.y, ICE_FX_TEXTURE.rootActive)
      .setDepth(DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(ICE_FX_ROOT_ALPHA)
      .setDisplaySize(ICE_FX_ROOT_DISPLAY_PX, ICE_FX_ROOT_DISPLAY_PX)
      .play(ICE_FX_ANIM.rootActive);
    registerWorldDraw?.(sprite);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      const entry = this.entries.get(enemyId);
      if (!entry || entry.sprite !== sprite) return;
      sprite.anims.pause();
    });
    this.entries.set(enemyId, { sprite, mode: "active_hold" });
  }

  private playEnding(
    enemyId: string,
    pos: { x: number; y: number } | undefined,
    registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
  ): void {
    const entry = this.entries.get(enemyId);
    if (!entry) return;
    const { x, y } = pos ?? { x: entry.sprite.x, y: entry.sprite.y };
    entry.sprite.destroy();
    if (!(this.scene.anims?.exists(ICE_FX_ANIM.rootEnding) ?? false)) {
      this.entries.delete(enemyId);
      return;
    }
    const sprite = this.scene.add
      .sprite(x, y, ICE_FX_TEXTURE.rootEnding)
      .setDepth(DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(ICE_FX_ROOT_ALPHA)
      .setDisplaySize(ICE_FX_ROOT_DISPLAY_PX, ICE_FX_ROOT_DISPLAY_PX)
      .play(ICE_FX_ANIM.rootEnding);
    registerWorldDraw?.(sprite);
    this.entries.set(enemyId, { sprite, mode: "ending" });
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      const current = this.entries.get(enemyId);
      if (current?.sprite === sprite) this.entries.delete(enemyId);
      sprite.destroy();
    });
  }
}