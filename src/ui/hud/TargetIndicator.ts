import type Phaser from "phaser";
import { PALETTE, PALETTE_CSS } from "../theme/uiPalette";

/** Small marker above a targeted enemy with a bobbing animation. */
export class TargetIndicator {
  private readonly root: Phaser.GameObjects.Container;
  private readonly bob: Phaser.GameObjects.Container;
  private follow: Phaser.GameObjects.Components.Transform | null = null;
  constructor(scene: Phaser.Scene, yOffset = 30) {
    this.root = scene.add.container(0, 0).setDepth(25);

    this.bob = scene.add.container(0, -yOffset);
    const chevron = scene.add
      .text(0, 0, "▼", { fontSize: "22px", color: PALETTE_CSS.amber400 })
      .setOrigin(0.5, 0.5);
    const ring = scene.add
      .circle(0, -10, 10)
      .setStrokeStyle(2, PALETTE.amber400)
      .setFillStyle(PALETTE.amber400, 0.15);
    this.bob.add([ring, chevron]);
    this.root.add(this.bob);

    scene.tweens.add({
      targets: this.bob,
      y: -yOffset - 8,
      duration: 480,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.hide();
  }

  attachTo(target: Phaser.GameObjects.Components.Transform): void {
    this.follow = target;
    this.show();
  }

  detach(): void {
    this.follow = null;
    this.hide();
  }

  updateWorldPosition(): void {
    if (!this.follow) return;
    this.root.setPosition(this.follow.x, this.follow.y);
  }

  worldRoot(): Phaser.GameObjects.Container {
    return this.root;
  }

  destroy(): void {
    this.root.destroy();
  }

  private show(): void {
    this.root.setVisible(true);
    this.root.setActive(true);
  }

  private hide(): void {
    this.root.setVisible(false);
    this.root.setActive(false);
  }
}
