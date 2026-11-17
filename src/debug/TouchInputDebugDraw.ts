import Phaser from "phaser";
import type { ScreenRect } from "../input/VirtualStick";
import type { VirtualStick } from "../input/VirtualStick";
import { interactiveObjectScreenRect } from "../ui/touchButton";

const SCREEN_DEPTH = 248;
const WORLD_DEPTH = 29;

export type FocusTapFlash = {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  picked: boolean;
  pickRadiusWorld: number;
  ageMs: number;
};

export type TouchInputDebugFrameOptions = {
  stick?: VirtualStick;
  excludeZones?: ScreenRect[];
  uiScreenRects?: ScreenRect[];
  /** Mirrors gameplay UI hit rules (Defense tap routing). */
  pointerUiBlocked?: (pointer: Phaser.Input.Pointer) => boolean;
  focusFlash?: FocusTapFlash | null;
};

/** Lightweight on-canvas overlay for mobile touch debugging (screen + world layers). */
export class TouchInputDebugDraw {
  private readonly scene: Phaser.Scene;
  private readonly screen: Phaser.GameObjects.Graphics;
  private readonly world: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.screen = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(SCREEN_DEPTH);
    this.world = scene.add.graphics().setDepth(WORLD_DEPTH);
  }

  worldGraphics(): Phaser.GameObjects.Graphics {
    return this.world;
  }

  uiGraphics(): Phaser.GameObjects.Graphics {
    return this.screen;
  }

  clear(): void {
    this.screen.clear();
    this.world.clear();
  }

  destroy(): void {
    this.screen.destroy();
    this.world.destroy();
  }

  draw(options: TouchInputDebugFrameOptions): void {
    this.screen.clear();
    this.world.clear();

    const zones = options.excludeZones ?? options.stick?.getDebugLayout().excludeZones ?? [];
    const uiRects =
      options.uiScreenRects ?? options.stick?.getDebugLayout().uiScreenRects ?? [];

    for (const z of zones) {
      this.screen.fillStyle(0xf59e0b, 0.12);
      this.screen.fillRect(z.x, z.y, z.width, z.height);
      this.screen.lineStyle(1, 0xfbbf24, 0.55);
      this.screen.strokeRect(z.x, z.y, z.width, z.height);
    }

    for (const z of uiRects) {
      this.screen.lineStyle(1.5, 0xf87171, 0.7);
      this.screen.strokeRect(z.x, z.y, z.width, z.height);
    }

    const layout = options.stick?.getDebugLayout();
    const stickState = options.stick?.getDebugState();
    if (layout && stickState) {
      if (stickState.pending) {
        this.screen.lineStyle(1, 0x93c5fd, 0.65);
        this.screen.strokeCircle(
          stickState.downX,
          stickState.downY,
          layout.dragThreshold,
        );
        this.drawCrosshair(stickState.downX, stickState.downY, 0x60a5fa, "pending");
      }
      if (stickState.active) {
        this.screen.fillStyle(0x2a2d38, 0.35);
        this.screen.fillCircle(stickState.originX, stickState.originY, layout.radius);
        this.screen.lineStyle(2, 0x7db8ff, 0.9);
        this.screen.strokeCircle(stickState.originX, stickState.originY, layout.radius);
        this.screen.fillStyle(0x7db8ff, 0.75);
        this.screen.fillCircle(stickState.knobX, stickState.knobY, layout.radius * 0.42);
        this.screen.lineStyle(1, 0xe0f2fe, 0.85);
        this.screen.lineBetween(
          stickState.originX,
          stickState.originY,
          stickState.knobX,
          stickState.knobY,
        );
      }
    }

    const pointers = this.scene.input.manager.pointers;
    for (const pointer of pointers) {
      if (!pointer.isDown) continue;
      const blockedByStick = options.stick?.wouldBlockPointer(pointer) ?? false;
      const blockedByUi = options.pointerUiBlocked?.(pointer) ?? false;
      const blocked = blockedByStick || blockedByUi;
      const color = blocked ? 0xfb7185 : 0x4ade80;
      this.drawCrosshair(pointer.x, pointer.y, color, `p${pointer.id}`);
      if (blocked) {
        this.screen.lineStyle(2, color, 0.85);
        this.screen.strokeCircle(pointer.x, pointer.y, 22);
      }

      const hits = this.scene.input.hitTestPointer(pointer);
      for (const hit of hits) {
        const bounds = this.boundsForHit(hit as Phaser.GameObjects.GameObject);
        if (!bounds) continue;
        this.screen.lineStyle(1, 0xf472b6, 0.75);
        this.screen.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      }
    }

    const flash = options.focusFlash;
    if (flash && flash.ageMs < 900) {
      const t = 1 - flash.ageMs / 900;
      const alpha = 0.25 + t * 0.55;
      this.screen.lineStyle(2, flash.picked ? 0x4ade80 : 0xfacc15, alpha);
      this.screen.strokeCircle(flash.screenX, flash.screenY, 14 + t * 6);
      this.drawCrosshair(flash.screenX, flash.screenY, flash.picked ? 0x4ade80 : 0xfacc15);

      this.world.lineStyle(2, flash.picked ? 0x4ade80 : 0xfacc15, alpha * 0.85);
      this.world.strokeCircle(flash.worldX, flash.worldY, flash.pickRadiusWorld);
      this.world.lineStyle(1, flash.picked ? 0x86efac : 0xfde047, alpha * 0.6);
      this.world.lineBetween(flash.worldX, flash.worldY - flash.pickRadiusWorld - 8, flash.worldX, flash.worldY);
    }
  }

  private drawCrosshair(x: number, y: number, color: number, _tag?: string): void {
    const r = 10;
    this.screen.lineStyle(2, color, 0.95);
    this.screen.lineBetween(x - r, y, x + r, y);
    this.screen.lineBetween(x, y - r, x, y + r);
  }

  private boundsForHit(
    obj: Phaser.GameObjects.GameObject,
  ): { x: number; y: number; width: number; height: number } | null {
    const fromInput = interactiveObjectScreenRect(obj);
    if (fromInput && fromInput.width > 0 && fromInput.height > 0) {
      return fromInput;
    }
    const go = obj as Phaser.GameObjects.Components.Transform &
      Phaser.GameObjects.Components.GetBounds &
      Phaser.GameObjects.GameObject;
    if (typeof go.getBounds !== "function") return null;
    const b = go.getBounds();
    if (b.width <= 0 || b.height <= 0) return null;
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }
}