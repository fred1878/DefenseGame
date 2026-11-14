import Phaser from "phaser";

/**
 * Touch/pointer virtual stick — returns normalized move direction.
 */
export class VirtualStick {
  private readonly base: Phaser.GameObjects.Arc;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly radius: number;
  private readonly originX: number;
  private readonly originY: number;
  private pointerId: number | null = null;
  private dir = new Phaser.Math.Vector2(0, 0);

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius = 56,
  ) {
    this.originX = x;
    this.originY = y;
    this.radius = radius;
    this.base = scene.add
      .circle(x, y, radius, 0x2a2d38, 0.55)
      .setScrollFactor(0)
      .setDepth(100);
    this.knob = scene.add
      .circle(x, y, radius * 0.42, 0x7db8ff, 0.85)
      .setScrollFactor(0)
      .setDepth(101);

    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
    scene.input.on("pointerupoutside", this.onUp, this);
  }

  getDirection(): Phaser.Math.Vector2 {
    return this.dir;
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
  if (!this.isInStickZone(pointer)) return;
    this.pointerId = pointer.id;
    this.updateFromPointer(pointer);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.updateFromPointer(pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.pointerId = null;
    this.dir.set(0, 0);
    this.knob.setPosition(this.originX, this.originY);
  }

  private isInStickZone(pointer: Phaser.Input.Pointer): boolean {
    const zoneW = this.radius * 3.5;
    const left = 0;
    const bottom = this.base.scene.scale.height;
    return (
      pointer.x >= left &&
      pointer.x <= left + zoneW &&
      pointer.y >= bottom - zoneW &&
      pointer.y <= bottom
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