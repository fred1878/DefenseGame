import Phaser from "phaser";

export type TouchButtonRectOptions = {
  width: number;
  height: number;
  depth?: number;
  scrollFactor?: number;
  tapPadding?: number;
  fontSize?: string;
};

function bindPress(
  obj: Phaser.GameObjects.GameObject,
  onPress: () => void,
): void {
  const go = obj as Phaser.GameObjects.GameObject & { input?: { alwaysEnabled?: boolean } };
  if (go.input) go.input.alwaysEnabled = true;

  const fire = () => onPress();
  obj.on(
    "pointerdown",
    (
      _pointer: Phaser.Input.Pointer,
      _lx: number,
      _ly: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      fire();
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
): Phaser.GameObjects.Container {
  const depth = options.depth ?? 100;
  const sf = options.scrollFactor ?? 0;
  const pad = options.tapPadding ?? 16;
  const hitW = options.width + pad * 2;
  const hitH = options.height + pad * 2;
  const fontSize = options.fontSize ?? "20px";

  const container = scene.add.container(x, y).setDepth(depth).setScrollFactor(sf);
  const bg = scene.add
    .rectangle(0, 0, options.width, options.height, 0x3b82f6, 1)
    .setStrokeStyle(2, 0x60a5fa);
  const text = scene.add.text(0, 0, label, { fontSize }).setOrigin(0.5);
  container.add([bg, text]);

  container.setSize(hitW, hitH);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
    Phaser.Geom.Rectangle.Contains,
  );
  bindPress(container, onPress);
  return container;
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
  bindPress(container, onPress);

  return {
    container,
    setLabel: (label: string) => text.setText(label),
    setOn: (on: boolean) => {
      bg.setFillStyle(on ? 0x15803d : 0x3f3f46, 1);
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
  bindPress(container, onPress);
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