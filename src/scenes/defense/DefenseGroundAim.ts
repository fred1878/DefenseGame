import type Phaser from "phaser";
import { spellById } from "../../content/spells";
import type { Player } from "../../entities/Player";
import {
  INPUT_MODALITY,
  isInputModalityActive,
  popInputModality,
  pushInputModality,
} from "../../input/inputModality";
import type { VirtualStick } from "../../input/VirtualStick";
import type { GroundTargetReticle } from "../../ui/GroundTargetReticle";
import {
  cameraWorldPoint,
  defensePlayAreaLayout,
  type SafeInsets,
} from "../../ui/screenLayout";
import {
  groundAimFromWorldPoint,
  pointerInDefensePlayArea,
} from "./defenseGroundAimInput";

/** Live scene state for manual ground-spell aiming (getters/setters keep it in sync). */
export type DefenseGroundAimHost = {
  scene: Phaser.Scene;
  readonly player: Player;
  readonly stick: VirtualStick | undefined;
  readonly safe: SafeInsets;
  readonly groundReticle: GroundTargetReticle;
  pendingGroundCast: string | null;
  groundAim: { x: number; y: number } | null;
  wu: (atDefault2x: number) => number;
  beginSpellCast: (spellId: string) => void;
};

/** Pointer tracking for armed ground spells: reticle drag, stick block, confirm on release. */
export class DefenseGroundAim {
  private pointerId: number | null = null;
  private fromUiBand = false;

  constructor(private readonly host: DefenseGroundAimHost) {}

  resetForNewRun(): void {
    this.pointerId = null;
    this.fromUiBand = false;
  }

  /** True when `pointer` is the one that armed / is dragging the ground reticle. */
  isAimGesture(pointer: Phaser.Input.Pointer): boolean {
    return this.pointerId !== null && pointer.id === this.pointerId;
  }

  clearGesture(): void {
    this.pointerId = null;
    this.fromUiBand = false;
    this.host.stick?.setExternalBlock(null);
  }

  private syncStickBlock(): void {
    const stick = this.host.stick;
    if (!stick) return;
    if (this.host.pendingGroundCast && this.fromUiBand) {
      stick.setExternalBlock(() => this.host.pendingGroundCast !== null);
    } else {
      stick.setExternalBlock(null);
    }
  }

  onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.host.pendingGroundCast) return;
    this.pointerId = pointer.id;
    const play = defensePlayAreaLayout(this.host.scene, this.host.safe);
    this.fromUiBand = !pointerInDefensePlayArea(pointer.x, pointer.y, play);
    this.syncStickBlock();
    this.updateFromPointer(pointer);
  }

  onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.host.pendingGroundCast || !pointer.isDown) return;
    if (this.pointerId !== null && pointer.id !== this.pointerId) {
      return;
    }
    this.updateFromPointer(pointer);
  }

  private updateFromPointer(pointer: Phaser.Input.Pointer): void {
    const def = spellById(this.host.pendingGroundCast ?? "");
    if (!def) return;
    const world = cameraWorldPoint(
      this.host.scene.cameras.main,
      pointer.x,
      pointer.y,
    );
    const px = this.host.player.sprite.x;
    const py = this.host.player.sprite.y;
    const maxR = this.host.wu(def.groundTargetMaxRangeWu ?? 240);
    const aim = groundAimFromWorldPoint(px, py, world.x, world.y, maxR);
    this.host.groundAim = aim;
    this.host.groundReticle.updatePosition(aim.x, aim.y);
  }

  confirm(pointer: Phaser.Input.Pointer): boolean {
    if (!this.host.pendingGroundCast) return false;
    const spellId = this.host.pendingGroundCast;
    this.updateFromPointer(pointer);
    this.host.pendingGroundCast = null;
    syncDefenseGroundAimModality(this.host.scene, null);
    this.clearGesture();
    this.host.beginSpellCast(spellId);
    return true;
  }
}

/** Push/pop the ground-aim input modality to match whether a ground cast is armed. */
export function syncDefenseGroundAimModality(
  scene: Phaser.Scene,
  pendingGroundCast: string | null,
): void {
  const active = isInputModalityActive(
    scene,
    INPUT_MODALITY.defenseGroundAim.id,
  );
  if (pendingGroundCast && !active) {
    pushInputModality(scene, INPUT_MODALITY.defenseGroundAim);
  } else if (!pendingGroundCast && active) {
    popInputModality(scene, INPUT_MODALITY.defenseGroundAim.id);
  }
}
