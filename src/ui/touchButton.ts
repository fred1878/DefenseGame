import Phaser from "phaser";

export type TouchButtonRectOptions = {
  width: number;
  height: number;
  depth?: number;
  scrollFactor?: number;
  tapPadding?: number;
  fontSize?: string;
  fillColor?: number;
  strokeColor?: number;
};

export type TouchButtonHandle = {
  container: Phaser.GameObjects.Container;
  setLabel: (text: string) => void;
};

type PressVisual = {
  bg?: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc | Phaser.GameObjects.Ellipse;
  colors?: { rest: number; pressed: number };
  pressScale?: number;
};

function addPressFeedback(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  visual?: PressVisual,
): void {
  const pressScale = visual?.pressScale ?? 0.9;

  const bounceBack = () => {
    if (visual?.bg && visual.colors) {
      visual.bg.setFillStyle(visual.colors.rest, 1);
    }
    scene.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 110,
      ease: "Back.easeOut",
    });
  };

  const onPress = () => {
    scene.tweens.killTweensOf(container);
    scene.tweens.add({
      targets: container,
      scaleX: pressScale,
      scaleY: pressScale,
      duration: 50,
      ease: "Quad.easeOut",
    });
    if (visual?.bg && visual.colors) {
      visual.bg.setFillStyle(visual.colors.pressed, 1);
    }
  };

  container.on("pointerdown", onPress);
  container.on("pointerup", bounceBack);
  container.on("pointerupoutside", bounceBack);
  container.on("pointerout", bounceBack);
}

function darkenColor(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) + (g << 8) + b;
}

function bindPress(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.GameObject,
  onPress: () => void,
  pressVisual?: PressVisual,
): void {
  const go = obj as Phaser.GameObjects.GameObject & { input?: { alwaysEnabled?: boolean } };
  if (go.input) go.input.alwaysEnabled = true;

  if (obj instanceof Phaser.GameObjects.Container) {
    addPressFeedback(scene, obj, pressVisual);
  }

  obj.on(
    "pointerdown",
    (
      _pointer: Phaser.Input.Pointer,
      _lx: number,
      _ly: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      onPress();
    },
  );
}

/**
 * Mobile-first button — interactive hit on the container (zones-in-containers miss hits on mobile).
 */
export function createTouchButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onPress: () => void,
  options: TouchButtonRectOptions,
): TouchButtonHandle {
  const depth = options.depth ?? 100;
  const sf = options.scrollFactor ?? 0;
  const pad = options.tapPadding ?? 16;
  const hitW = options.width + pad * 2;
  const hitH = options.height + pad * 2;
  const fontSize = options.fontSize ?? "20px";
  const fill = options.fillColor ?? 0x3b82f6;
  const stroke = options.strokeColor ?? 0x60a5fa;

  const container = scene.add.container(x, y).setDepth(depth).setScrollFactor(sf);
  const bg = scene.add
    .rectangle(0, 0, options.width, options.height, fill, 1)
    .setStrokeStyle(2, stroke);
  const text = scene.add.text(0, 0, label, { fontSize }).setOrigin(0.5);
  container.add([bg, text]);

  container.setSize(hitW, hitH);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
    Phaser.Geom.Rectangle.Contains,
  );
  const colors = { rest: fill, pressed: darkenColor(fill, 0.72) };
  bindPress(scene, container, onPress, { bg, colors, pressScale: 0.88 });

  return {
    container,
    setLabel: (next: string) => text.setText(next),
  };
}

export function createTouchToggleButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  initialLabel: string,
  width: number,
  height: number,
  onPress: () => void,
  depth = 200,
): { container: Phaser.GameObjects.Container; setLabel: (text: string) => void; setOn: (on: boolean) => void } {
  const pad = 12;
  const hitW = width + pad * 2;
  const hitH = height + pad * 2;

  const container = scene.add.container(x, y).setDepth(depth).setScrollFactor(0);
  const bg = scene.add
    .rectangle(0, 0, width, height, 0x3f3f46, 1)
    .setStrokeStyle(2, 0x71717a);
  const text = scene.add.text(0, 0, initialLabel, { fontSize: "14px" }).setOrigin(0.5);
  container.add([bg, text]);

  container.setSize(hitW, hitH);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
    Phaser.Geom.Rectangle.Contains,
  );
  const colors = { rest: 0x3f3f46, pressed: 0x27272a };
  bindPress(scene, container, onPress, { bg, colors, pressScale: 0.9 });

  return {
    container,
    setLabel: (label: string) => text.setText(label),
    setOn: (on: boolean) => {
      colors.rest = on ? 0x15803d : 0x3f3f46;
      colors.pressed = darkenColor(colors.rest, 0.75);
      bg.setFillStyle(colors.rest, 1);
      bg.setStrokeStyle(2, on ? 0x4ade80 : 0x71717a);
    },
  };
}

export function createTouchCircleButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  radius: number,
  onPress: () => void,
  depth = 150,
): Phaser.GameObjects.Container {
  const pad = 16;
  const hitR = radius + pad;
  const container = scene.add.container(x, y).setDepth(depth).setScrollFactor(0);
  const bg = scene.add.circle(0, 0, radius, 0xea580c, 1).setStrokeStyle(2, 0xfdba74);
  const text = scene.add.text(0, 0, label, { fontSize: "18px" }).setOrigin(0.5);
  container.add([bg, text]);

  container.setSize(hitR * 2, hitR * 2);
  container.setInteractive(
    new Phaser.Geom.Circle(0, 0, hitR),
    Phaser.Geom.Circle.Contains,
  );
  const colors = { rest: 0xea580c, pressed: 0xc2410c };
  bindPress(scene, container, onPress, { bg, colors, pressScale: 0.9 });
  return container;
}

/** Screen-space hit test for UI that must block the movement stick. */
export function pointerInScreenRect(
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}