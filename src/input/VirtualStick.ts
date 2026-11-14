import Phaser from "phaser";

export type ScreenRect = { x: number; y: number; width: number; height: number };

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
  private dir = new Phaser.Math.Vector2(0, 0);

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

    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
    scene.input.on("pointerupoutside", this.onUp, this);
  }

  getDirection(): Phaser.Math.Vector2 {
    return this.dir;
  }

  /**
   * After pointerup: `tap` with screen coords, `drag` if stick was used, else `none`.
   */
  tryConsumeTap(
    pointer: Phaser.Input.Pointer,
  ): { kind: "tap"; x: number; y: number } | { kind: "drag" } | { kind: "none" } {
    if (this.dragEndPointerId === pointer.id) {
      this.dragEndPointerId = null;
      return { kind: "drag" };
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
    scene.input.off("pointerdown", this.onDown, this);
    scene.input.off("pointermove", this.onMove, this);
    scene.input.off("pointerup", this.onUp, this);
    scene.input.off("pointerupoutside", this.onUp, this);
    this.base.destroy();
    this.knob.destroy();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== null) return;
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
      if (this.shouldBlock(pointer)) {
        this.cancelTouch();
        return;
      }
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

  private shouldBlock(pointer: Phaser.Input.Pointer): boolean {
    if (this.isInUiScreenRect(pointer.x, pointer.y)) return true;
    if (this.isInExcludeZone(pointer.x, pointer.y)) return true;
    if (this.pointerOverInteractiveUI(pointer)) return true;
    return false;
  }

  private isInUiScreenRect(x: number, y: number): boolean {
    return this.uiScreenRects.some(
      (z) =>
        x >= z.x &&
        x <= z.x + z.width &&
        y >= z.y &&
        y <= z.y + z.height,
    );
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
    return this.excludeZones.some(
      (z) =>
        x >= z.x &&
        x <= z.x + z.width &&
        y >= z.y &&
        y <= z.y + z.height,
    );
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