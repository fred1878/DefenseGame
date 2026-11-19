import Phaser from "phaser";
import { STICK_POST_DRAG_TAP_SUPPRESS_MS } from "./inputTuning";

export type ScreenRect = { x: number; y: number; width: number; height: number };

export function pointInScreenRects(
  x: number,
  y: number,
  rects: ScreenRect[],
): boolean {
  return rects.some(
    (z) =>
      x >= z.x &&
      x <= z.x + z.width &&
      y >= z.y &&
      y <= z.y + z.height,
  );
}

export type VirtualStickOptions = {
  radius?: number;
  /** Extra objects that always block stick start (in addition to any interactive UI). */
  blockers?: Phaser.GameObjects.GameObject[];
  /** Non-interactive screen regions (e.g. HUD) that reject stick start. */
  excludeZones?: ScreenRect[];
  /** Pixels before stick appears — avoids stealing taps (default 16). */
  dragThresholdPx?: number;
  /** Screen rects that always block the stick (button clusters). */
  uiScreenRects?: ScreenRect[];
  /** Defense UI camera: do not draw stick on world viewport. */
  registerUiDraw?: (go: Phaser.GameObjects.GameObject) => void;
};

/**
 * Floating virtual stick: drag from most of the screen after a small movement
 * threshold. Ignores interactive UI (buttons, zones).
 */
export class VirtualStick {
  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly radius: number;
  private readonly blockers: Phaser.GameObjects.GameObject[];
  private readonly excludeZones: ScreenRect[];
  private readonly dragThreshold: number;
  private readonly uiScreenRects: ScreenRect[];
  private originX = 0;
  private originY = 0;
  private downX = 0;
  private downY = 0;
  private pointerId: number | null = null;
  private pending = false;
  private active = false;
  private gestureHadDrag = false;
  private pendingTap: { x: number; y: number; pointerId: number } | null = null;
  private dragEndPointerId: number | null = null;
  private dragSuppressUntilMs = 0;
  private dir = new Phaser.Math.Vector2(0, 0);
  private e2eOverride: Phaser.Math.Vector2 | null = null;
  private externalBlock: (() => boolean) | null = null;

  constructor(scene: Phaser.Scene, options: VirtualStickOptions = {}) {
    this.scene = scene;
    this.radius = options.radius ?? 56;
    this.blockers = options.blockers ?? [];
    this.excludeZones = options.excludeZones ?? [];
    this.dragThreshold = options.dragThresholdPx ?? 16;
    this.uiScreenRects = options.uiScreenRects ?? [];

    this.base = scene.add
      .circle(0, 0, this.radius, 0x2a2d38, 0.55)
      .setScrollFactor(0)
      .setDepth(50)
      .setVisible(false);
    this.knob = scene.add
      .circle(0, 0, this.radius * 0.42, 0x7db8ff, 0.85)
      .setScrollFactor(0)
      .setDepth(51)
      .setVisible(false);

    options.registerUiDraw?.(this.base);
    options.registerUiDraw?.(this.knob);

    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
    scene.input.on("pointerupoutside", this.onUp, this);
  }

  getDirection(): Phaser.Math.Vector2 {
    return this.e2eOverride ?? this.dir;
  }

  /** E2E-only programmatic stick (normalized dx/dy). */
  setE2eOverride(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) {
      this.e2eOverride = null;
      return;
    }
    const len = Math.hypot(dx, dy);
    if (!this.e2eOverride) {
      this.e2eOverride = new Phaser.Math.Vector2(dx / len, dy / len);
    } else {
      this.e2eOverride.set(dx / len, dy / len);
    }
  }

  /**
   * After pointerup: `tap` with screen coords, `drag` if stick was used, else `none`.
   */
  tryConsumeTap(
    pointer: Phaser.Input.Pointer,
  ): { kind: "tap"; x: number; y: number } | { kind: "drag" } | { kind: "none" } {
    if (this.dragEndPointerId === pointer.id) {
      const suppressing =
        performance.now() < this.dragSuppressUntilMs;
      this.dragEndPointerId = null;
      this.dragSuppressUntilMs = 0;
      if (suppressing) return { kind: "drag" };
    }
    const tap = this.pendingTap;
    this.pendingTap = null;
    if (tap && tap.pointerId === pointer.id) {
      return { kind: "tap", x: tap.x, y: tap.y };
    }
    return { kind: "none" };
  }

  setBlockers(blockers: Phaser.GameObjects.GameObject[]): void {
    this.blockers.length = 0;
    this.blockers.push(...blockers);
  }

  setUiScreenRects(rects: ScreenRect[]): void {
    this.uiScreenRects.length = 0;
    this.uiScreenRects.push(...rects);
  }

  /** When this returns true, the stick will not start or update (e.g. ground-aim drag). */
  setExternalBlock(fn: (() => boolean) | null): void {
    this.externalBlock = fn;
  }

  /** Exposed for touch-debug overlay (same rules as stick capture). */
  wouldBlockPointer(pointer: Phaser.Input.Pointer): boolean {
    return this.shouldBlock(pointer);
  }

  getDebugLayout(): {
    radius: number;
    dragThreshold: number;
    excludeZones: ScreenRect[];
    uiScreenRects: ScreenRect[];
  } {
    return {
      radius: this.radius,
      dragThreshold: this.dragThreshold,
      excludeZones: this.excludeZones,
      uiScreenRects: this.uiScreenRects,
    };
  }

  getDebugState(): {
    pointerId: number | null;
    pending: boolean;
    active: boolean;
    originX: number;
    originY: number;
    knobX: number;
    knobY: number;
    downX: number;
    downY: number;
  } {
    return {
      pointerId: this.pointerId,
      pending: this.pending,
      active: this.active,
      originX: this.originX,
      originY: this.originY,
      knobX: this.knob.x,
      knobY: this.knob.y,
      downX: this.downX,
      downY: this.downY,
    };
  }

  destroy(scene: Phaser.Scene): void {
    const input = scene.input;
    if (input) {
      input.off("pointerdown", this.onDown, this);
      input.off("pointermove", this.onMove, this);
      input.off("pointerup", this.onUp, this);
      input.off("pointerupoutside", this.onUp, this);
    }
    this.base.destroy();
    this.knob.destroy();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== null) return;
    this.clearDragEndSuppression();

    if (this.shouldBlock(pointer)) return;

    this.pointerId = pointer.id;
    this.pending = true;
    this.active = false;
    this.gestureHadDrag = false;
    this.downX = pointer.x;
    this.downY = pointer.y;
    this.dir.set(0, 0);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;

    if (this.pending && !this.active) {
      const dist = Phaser.Math.Distance.Between(
        this.downX,
        this.downY,
        pointer.x,
        pointer.y,
      );
      if (dist < this.dragThreshold) return;
      this.pending = false;
      this.active = true;
      this.gestureHadDrag = true;
      this.originX = this.downX;
      this.originY = this.downY;
      this.base.setPosition(this.originX, this.originY).setVisible(true);
      this.knob.setPosition(this.originX, this.originY).setVisible(true);
    }

    if (this.active) this.updateFromPointer(pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    if (this.gestureHadDrag) {
      this.dragEndPointerId = pointer.id;
      this.dragSuppressUntilMs =
        performance.now() + STICK_POST_DRAG_TAP_SUPPRESS_MS;
    } else if (this.pending) {
      this.pendingTap = { x: pointer.x, y: pointer.y, pointerId: pointer.id };
    }
    this.cancelTouch();
  }

  private cancelTouch(): void {
    this.pointerId = null;
    this.pending = false;
    this.active = false;
    this.gestureHadDrag = false;
    this.dir.set(0, 0);
    this.base.setVisible(false);
    this.knob.setVisible(false);
  }

  private clearDragEndSuppression(): void {
    this.dragEndPointerId = null;
    this.dragSuppressUntilMs = 0;
  }

  private shouldBlock(pointer: Phaser.Input.Pointer): boolean {
    if (this.externalBlock?.()) return true;
    if (this.isInUiScreenRect(pointer.x, pointer.y)) return true;
    if (this.isInExcludeZone(pointer.x, pointer.y)) return true;
    if (this.pointerOverInteractiveUI(pointer)) return true;
    return false;
  }

  private isInUiScreenRect(x: number, y: number): boolean {
    return pointInScreenRects(x, y, this.uiScreenRects);
  }

  private pointerOverInteractiveUI(pointer: Phaser.Input.Pointer): boolean {
    const hits = this.scene.input.hitTestPointer(pointer);
    for (const hit of hits) {
      if (hit === this.base || hit === this.knob) continue;
      if (this.hasInteractiveInput(hit as Phaser.GameObjects.GameObject)) return true;
    }
    return false;
  }

  private hasInteractiveInput(obj: Phaser.GameObjects.GameObject): boolean {
    let node: Phaser.GameObjects.GameObject | null = obj;
    while (node) {
      if (this.blockers.includes(node)) return true;
      if (node.input?.enabled) return true;
      const parent: Phaser.GameObjects.Container | null =
        (node as Phaser.GameObjects.GameObject & { parentContainer?: Phaser.GameObjects.Container })
          .parentContainer ?? null;
      node = parent;
    }
    return false;
  }

  private isInExcludeZone(x: number, y: number): boolean {
    return pointInScreenRects(x, y, this.excludeZones);
  }

  private updateFromPointer(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.originX;
    const dy = pointer.y - this.originY;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, this.radius);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;
    this.knob.setPosition(
      this.originX + nx * clamped,
      this.originY + ny * clamped,
    );
    if (len > 0) this.dir.set(nx, ny);
    else this.dir.set(0, 0);
  }
}