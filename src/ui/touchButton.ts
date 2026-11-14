import Phaser from "phaser";

export type TouchButtonRectOptions = {
  width: number;
  height: number;
  depth?: number;
  scrollFactor?: number;
  tapPadding?: number;
  fontSize?: string;
};

/**
 * Mobile-first button: large hit zone, pointerdown (not pointerup), stops propagation.
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
  const pad = options.tapPadding ?? 12;
  const hitW = options.width + pad * 2;
  const hitH = options.height + pad * 2;
  const fontSize = options.fontSize ?? "20px";

  const container = scene.add.container(x, y).setDepth(depth).setScrollFactor(sf);
  const bg = scene.add
    .rectangle(0, 0, options.width, options.height, 0x3b82f6, 1)
    .setStrokeStyle(2, 0x60a5fa);
  const text = scene.add.text(0, 0, label, { fontSize }).setOrigin(0.5);
  container.add([bg, text]);

  const zone = scene.add.zone(0, 0, hitW, hitH);
  zone.setInteractive(
    new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
    Phaser.Geom.Rectangle.Contains,
  );
  container.add(zone);

  bindTouchPress(zone, onPress);
  return container;
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
  const pad = 14;
  const hitR = radius + pad;
  const container = scene.add.container(x, y).setDepth(depth).setScrollFactor(0);
  const bg = scene.add.circle(0, 0, radius, 0xea580c, 1).setStrokeStyle(2, 0xfdba74);
  const text = scene.add.text(0, 0, label, { fontSize: "18px" }).setOrigin(0.5);
  container.add([bg, text]);

  const zone = scene.add.zone(0, 0, hitR * 2, hitR * 2);
  zone.setInteractive(
    new Phaser.Geom.Circle(0, 0, hitR),
    Phaser.Geom.Circle.Contains,
  );
  container.add(zone);

  bindTouchPress(zone, onPress);
  return container;
}

function bindTouchPress(
  zone: Phaser.GameObjects.Zone,
  onPress: () => void,
): void {
  const fire = () => onPress();
  zone.on(
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