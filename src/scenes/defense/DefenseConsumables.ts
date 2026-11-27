import { UI_FONT_FAMILY } from "../../ui/layout/uiTextStyle";
import type Phaser from "phaser";
import { tuning } from "../../tuning/gameTuning";
import { DEFENSE_UI_DEPTH } from "../../config/renderDepth";
import { PALETTE_CSS } from "../../ui/theme/uiPalette";
import {
  applyHealAmount,
  applySpellBlastAt,
} from "../../combat/rules/SpellEffects";
import type { EnemySpellStatusMap } from "../../combat/rules/enemySpellStatus";
import type { SaveGame } from "../../core/save/saveTypes";
import type { Player } from "../../entities/Player";
import {
  consumableButtonState,
  consumableKindForKey,
  pickBombTarget,
} from "../../gear/consumableUse";
import {
  bombBlastSpellDef,
  quickConsumable,
  spendConsumable,
} from "../../gear/consumables";
import type { BombDef, ConsumableKind } from "../../gear/consumableTypes";
import type { TouchButtonHandle } from "../../ui/touch/touchButton";

type EnemyTarget = Parameters<typeof applySpellBlastAt>[4][number];

export type DefenseConsumablesHost = {
  scene: Phaser.Scene;
  save: SaveGame;
  player: Player;
  potionBtn: TouchButtonHandle;
  bombBtn: TouchButtonHandle;
  enemyTargets: () => EnemyTarget[];
  focusEnemyId: () => string | null;
  enemySpellStatus: () => EnemySpellStatusMap;
  wu: (n: number) => number;
  flashNova: (
    x: number,
    y: number,
    r: number,
    def: { blastTextureKey: string },
  ) => void;
  registerWorldDraw: (go: Phaser.GameObjects.GameObject) => void;
  registerUiDraw: (go: Phaser.GameObjects.GameObject) => void;
  /** False once the night has ended or a modal pauses play. */
  canAct: () => boolean;
};

/**
 * Potion / bomb HUD buttons and Q / E hotkeys. Charges are spent on the run
 * save, which night end and run exit persist.
 */
export class DefenseConsumables {
  private readyAt: Record<ConsumableKind, number> = { heal: 0, bomb: 0 };
  private lastLook = "";
  private readonly onKey = (ev: KeyboardEvent): void => {
    if (ev.repeat) return;
    const kind = consumableKindForKey(ev.key);
    if (kind) this.use(kind);
  };

  constructor(private readonly host: DefenseConsumablesHost) {
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this.onKey);
    }
    this.refresh(true);
  }

  destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this.onKey);
    }
  }

  use(kind: ConsumableKind): void {
    const h = this.host;
    if (!h.canAct()) return;
    const now = h.scene.time.now;
    if (now < this.readyAt[kind]) return;
    const def = quickConsumable(h.save, kind);
    if (!def) return;
    if (kind === "heal") {
      const d = h.player.damageable;
      if (d.hp >= d.maxHp) {
        this.toast("Already at full HP");
        return;
      }
      applyHealAmount(d, def.healHp ?? 0);
    } else {
      const spell = bombBlastSpellDef(def);
      const bomb = def.bomb;
      if (!spell || !bomb) return;
      const from = { x: h.player.sprite.x, y: h.player.sprite.y };
      const targets = h.enemyTargets();
      const target = pickBombTarget(
        from,
        targets,
        h.focusEnemyId(),
        h.wu(bomb.rangeWu),
      );
      if (!target) {
        this.toast("No enemy in range");
        return;
      }
      this.throwBomb(from, target, bomb, () => {
        applySpellBlastAt(
          h.scene,
          target.x,
          target.y,
          spell,
          h.enemyTargets(),
          1,
          h.enemySpellStatus(),
        );
        h.flashNova(target.x, target.y, h.wu(bomb.radiusWu), {
          blastTextureKey: bomb.blast,
        });
      });
    }
    const spent = spendConsumable(h.save, def.id);
    if (spent) h.save.consumables = spent.consumables;
    this.readyAt[kind] = now + def.cooldownMs;
    this.refresh(true);
  }

  private throwBomb(
    from: { x: number; y: number },
    to: { x: number; y: number },
    bomb: BombDef,
    onLand: () => void,
  ): void {
    const texture = bomb.projectile;
    const scene = this.host.scene;
    if (!scene.textures.exists(texture)) {
      onLand();
      return;
    }
    const sprite = scene.add.image(from.x, from.y, texture).setDepth(900);
    this.host.registerWorldDraw(sprite);
    scene.tweens.add({
      targets: sprite,
      x: to.x,
      y: to.y,
      angle: 360,
      duration: bomb.throwMs,
      onComplete: () => {
        sprite.destroy();
        onLand();
      },
    });
  }

  private toast(message: string): void {
    const { scene, potionBtn } = this.host;
    const t = scene.add
      .text(potionBtn.container.x, potionBtn.container.y - 40, message, {
        fontFamily: UI_FONT_FAMILY,
        fontSize: "20px",
        color: PALETTE_CSS.amber200,
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(DEFENSE_UI_DEPTH.nightEnd);
    this.host.registerUiDraw(t);
    const feel = tuning("gameplay").feel;
    scene.tweens.add({
      targets: t,
      alpha: 0,
      y: t.y - feel.consumableToastRisePx,
      delay: feel.consumableToastHoldMs,
      duration: feel.consumableToastFadeMs,
      onComplete: () => t.destroy(),
    });
  }

  /** Update labels / visibility (cheap: only touches objects when the look changes). */
  refresh(force = false): void {
    const h = this.host;
    const now = h.scene.time.now;
    const active = h.canAct();
    const state = (kind: ConsumableKind) => {
      const s = consumableButtonState(h.save, kind, now, this.readyAt[kind]);
      return active ? s : { ...s, visible: false };
    };
    const heal = state("heal");
    const bomb = state("bomb");
    const look = JSON.stringify([heal, bomb]);
    if (!force && look === this.lastLook) return;
    this.lastLook = look;
    apply(h.potionBtn, heal);
    apply(h.bombBtn, bomb);
  }
}

function apply(
  btn: TouchButtonHandle,
  s: { visible: boolean; enabled: boolean; label: string },
): void {
  btn.setLabel(s.label);
  btn.container.setVisible(s.visible);
  btn.container.setAlpha(s.enabled ? 1 : 0.5);
  if (s.visible) btn.container.setInteractive();
  else btn.container.disableInteractive();
}
