import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../../config";
import {
  PVFX_ANIM,
  PVFX_TEXTURE,
  registerCombatPvfxAnimations,
} from "../../content/combatPvfxAssets";
import type { EnemySpellStatusMap } from "../rules/enemySpellStatus";

const DEPTH = DEFENSE_RENDER_DEPTH.enemyCombatFx;
/** Strong ice-blue stun tint (deep freeze). */
export const DEEP_FREEZE_STUN_TINT = 0x66b8ff;

type StunFxEntry = {
  sprite: Phaser.GameObjects.Sprite;
  mode: "loop" | "release";
  tinted: boolean;
};

/** Ice-shatter PVFX loop (first 3 frames) + release on stun end. */
export class EnemyIceStunFxController {
  private readonly entries = new Map<string, StunFxEntry>();
  private prevStunned = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  reset(): void {
    for (const entry of this.entries.values()) entry.sprite.destroy();
    this.entries.clear();
    this.prevStunned.clear();
  }

  tick(
    enemies: Array<{
      id: string;
      sprite: Phaser.Physics.Arcade.Sprite;
    }>,
    status: EnemySpellStatusMap,
    registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
  ): void {
    if (!this.scene.textures.exists(PVFX_TEXTURE.iceShatter)) {
      this.reset();
      return;
    }
    registerCombatPvfxAnimations(this.scene);
    const stunnedNow = new Set<string>();
    const posById = new Map<string, { x: number; y: number }>();
    for (const e of enemies) {
      if (!e.sprite.active) continue;
      posById.set(e.id, { x: e.sprite.x, y: e.sprite.y });
      const stunned = status.isStunned(e.id);
      if (stunned) {
        stunnedNow.add(e.id);
        if (!this.entries.has(e.id)) {
          e.sprite.setTint(DEEP_FREEZE_STUN_TINT);
        }
      } else if (this.entries.get(e.id)?.tinted) {
        e.sprite.clearTint();
      }
    }

    for (const id of stunnedNow) {
      if (!this.prevStunned.has(id) && !this.entries.has(id)) {
        this.spawnLoop(id, posById.get(id)!, registerWorldDraw);
      }
    }

    for (const id of this.prevStunned) {
      if (!stunnedNow.has(id)) {
        const entry = this.entries.get(id);
        if (entry?.mode === "loop") {
          this.playRelease(id, posById.get(id), registerWorldDraw);
        }
      }
    }

    this.prevStunned = stunnedNow;

    for (const [id, entry] of this.entries) {
      const pos = posById.get(id);
      if (!pos) continue;
      entry.sprite.setPosition(pos.x, pos.y);
    }
  }

  private spawnLoop(
    enemyId: string,
    pos: { x: number; y: number },
    registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
  ): void {
    if (!(this.scene.anims?.exists(PVFX_ANIM.iceShatterStunLoop) ?? false))
      return;
    const sprite = this.scene.add
      .sprite(pos.x, pos.y, PVFX_TEXTURE.iceShatter)
      .setDepth(DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.9)
      .setDisplaySize(88, 56)
      .play(PVFX_ANIM.iceShatterStunLoop);
    registerWorldDraw?.(sprite);
    this.entries.set(enemyId, { sprite, mode: "loop", tinted: true });
  }

  private playRelease(
    enemyId: string,
    pos: { x: number; y: number } | undefined,
    registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
  ): void {
    const entry = this.entries.get(enemyId);
    if (!entry) return;
    const { x, y } = pos ?? { x: entry.sprite.x, y: entry.sprite.y };
    entry.sprite.destroy();
    if (!(this.scene.anims?.exists(PVFX_ANIM.iceShatterRelease) ?? false)) {
      this.entries.delete(enemyId);
      return;
    }
    const sprite = this.scene.add
      .sprite(x, y, PVFX_TEXTURE.iceShatter)
      .setDepth(DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.9)
      .setDisplaySize(88, 56)
      .play(PVFX_ANIM.iceShatterRelease);
    registerWorldDraw?.(sprite);
    this.entries.set(enemyId, { sprite, mode: "release", tinted: false });
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      const current = this.entries.get(enemyId);
      if (current?.sprite === sprite) this.entries.delete(enemyId);
      sprite.destroy();
    });
  }
}
