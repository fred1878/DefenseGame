import Phaser from "phaser";

export type ScreenRect = { x: number; y: number; width: number; height: number };

export type VirtualStickOptions = {
  radius?: number;
  /** Interactive UI objects: touches on these do not start the stick. */
  blockers?: Phaser.GameObjects.GameObject[];
  /** Non-interactive screen regions (e.g. HUD) that reject stick start. */
  excludeZones?: ScreenRect[];
};

/**
 * Floating virtual stick: touch anywhere (except blockers) to spawn the pad at
 * your finger and drag. Hidden until active.
 */
export class VirtualStick {
  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly radius: number;
  private readonly blockers: Phaser.GameObjects.GameObject[];
  private readonly excludeZones: ScreenRect[];
  private originX = 0;
  private originY = 0;
  private pointerId: number | null = null;
  private active = false;
  private dir = new Phaser.Math.Vector2(0, 0);

  constructor(scene: Phaser.Scene, options: VirtualStickOptions = {}) {
    this.scene = scene;
    this.radius = options.radius ?? 56;
    this.blockers = options.blockers ?? [];
    this.excludeZones = options.excludeZones ?? [];

    this.base = scene.add
      .circle(0, 0, this.radius, 0x2a2d38, 0.55)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
    this.knob = scene.add
      .circle(0, 0, this.radius * 0.42, 0x7db8ff, 0.85)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);

    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
    scene.input.on("pointerupoutside", this.onUp, this);
  }

  getDirection(): Phaser.Math.Vector2 {
    return this.dir;
  }

  setBlockers(blockers: Phaser.GameObjects.GameObject[]): void {
    this.blockers.length = 0;
    this.blockers.push(...blockers);
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
    this.active = true;
    this.originX = pointer.x;
    this.originY = pointer.y;
    this.base.setPosition(this.originX, this.originY).setVisible(true);
    this.knob.setPosition(this.originX, this.originY).setVisible(true);
    this.updateFromPointer(pointer);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.updateFromPointer(pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.endTouch();
  }

  private endTouch(): void {
    this.pointerId = null;
    this.active = false;
    this.dir.set(0, 0);
    this.base.setVisible(false);
    this.knob.setVisible(false);
  }

  private shouldBlock(pointer: Phaser.Input.Pointer): boolean {
    if (this.isInExcludeZone(pointer.x, pointer.y)) return true;

    const hits = this.scene.input.hitTestPointer(pointer);
    for (const hit of hits) {
      if (this.isBlockedObject(hit)) return true;
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

  private isBlockedObject(obj: Phaser.GameObjects.GameObject): boolean {
    for (const blocker of this.blockers) {
      if (obj === blocker) return true;
      if (blocker instanceof Phaser.GameObjects.Container) {
        if (blocker.list.includes(obj as Phaser.GameObjects.GameObject)) return true;
      }
    }
    return false;
  }

  private updateFromPointer(pointer: Phaser.Input.Pointer): void {
    if (!this.active) return;
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