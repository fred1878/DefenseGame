import Phaser from "phaser";
import { PALETTE, PALETTE_CSS } from "../theme/uiPalette";
import { uiTextResolution } from "../../core/render/displayScale";
import { scaleUiX } from "../../config/uiScale";
import {
  parseUiFontSizePx,
  UI_FONT_FAMILY,
  uiTextStrokeAllowed,
} from "../layout/uiTextStyle";
import {
  type BgVisual,
  MEDIEVAL_LABEL,
  bindPress,
  darkenColor,
  darkenTint,
  isImageBg,
} from "./touchButtonPress";
import { STROKE_PX } from "../layout/uiRoundedRect";
import {
  createUiRoundedRect,
  isUiRoundedRect,
  paintUiRoundedRect,
} from "../layout/uiRoundedRect";

export type TouchButtonRectOptions = {
  width: number;
  height: number;
  depth?: number;
  scrollFactor?: number;
  tapPadding?: number;
  fontSize?: string;
  fillColor?: number;
  strokeColor?: number;
  frameTextureKey?: string;
  activateOn?: "pointerdown" | "pointerup";
  skipPressBinding?: boolean;
};

export type TouchToggleOptions = {
  frameTextureKey?: string;
  onBgTint?: number;
  offBgTint?: number;
  onTextColor?: string;
  offTextColor?: string;
};

export type TouchButtonHandle = {
  container: Phaser.GameObjects.Container;
  setLabel: (text: string) => void;
};

function createButtonBackground(
  scene: Phaser.Scene,
  width: number,
  height: number,
  fill: number,
  stroke: number,
  frameTextureKey?: string,
): BgVisual {
  if (frameTextureKey && scene.textures.exists(frameTextureKey)) {
    return scene.add.image(0, 0, frameTextureKey).setDisplaySize(width, height);
  }
  return createUiRoundedRect(scene, width, height, fill, stroke);
}

function labelStyle(scene: Phaser.Scene, fontSize: string, textured: boolean) {
  const base: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: UI_FONT_FAMILY,
    fontSize,
    resolution: uiTextResolution(scene),
  };
  if (!textured) return base;
  const px = parseUiFontSizePx(fontSize);
  if (!uiTextStrokeAllowed(px)) {
    return { ...base, color: MEDIEVAL_LABEL.color };
  }
  return {
    ...base,
    color: MEDIEVAL_LABEL.color,
    stroke: MEDIEVAL_LABEL.stroke,
    strokeThickness: Math.max(2, scaleUiX(2)),
  };
}

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
  const pad = options.tapPadding ?? scaleUiX(20);
  const hitW = options.width + pad * 2;
  const hitH = options.height + pad * 2;
  const fontSize = options.fontSize ?? `${scaleUiX(20)}px`;
  const fill = options.fillColor ?? 0x3b82f6;
  const stroke = options.strokeColor ?? PALETTE.blue400;
  const activateOn = options.activateOn ?? "pointerdown";
  const textured = Boolean(options.frameTextureKey);

  const container = scene.add
    .container(Math.round(x), Math.round(y))
    .setDepth(depth)
    .setScrollFactor(sf);
  const bg = createButtonBackground(
    scene,
    options.width,
    options.height,
    fill,
    stroke,
    options.frameTextureKey,
  );
  const text = scene.add
    .text(0, 0, label, labelStyle(scene, fontSize, textured))
    .setOrigin(0.5);
  container.add([bg, text]);

  container.setSize(hitW, hitH);
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, hitW, hitH),
    Phaser.Geom.Rectangle.Contains,
  );
  const colors = textured
    ? { rest: PALETTE.white, pressed: darkenTint(PALETTE.white, 0.68) }
    : { rest: fill, pressed: darkenColor(fill, 0.72) };
  if (!options.skipPressBinding) {
    bindPress(
      scene,
      container,
      onPress,
      { bg, colors, pressScale: 0.88, textured },
      activateOn,
    );
  }

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
  toggleOptions?: TouchToggleOptions,
): {
  container: Phaser.GameObjects.Container;
  setLabel: (text: string) => void;
  setOn: (on: boolean) => void;
  getOn: () => boolean;
} {
  const pad = scaleUiX(12);
  const hitW = width + pad * 2;
  const hitH = height + pad * 2;
  const frameKey = toggleOptions?.frameTextureKey;
  const textured = Boolean(frameKey);

  const container = scene.add
    .container(Math.round(x), Math.round(y))
    .setDepth(depth)
    .setScrollFactor(0);
  const bg = createButtonBackground(
    scene,
    width,
    height,
    PALETTE.zinc700,
    PALETTE.zinc500,
    frameKey,
  );
  const labelPx = textured ? scaleUiX(15) : scaleUiX(14);
  const text = scene.add
    .text(0, 0, initialLabel, {
      ...labelStyle(scene, `${labelPx}px`, textured),
    })
    .setOrigin(0.5)
    .setAlign("center");
  if (initialLabel.includes("\n")) {
    text.setFontSize(scaleUiX(12));
    text.setLineSpacing(scaleUiX(-2));
  }
  container.add([bg, text]);

  container.setSize(hitW, hitH);
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, hitW, hitH),
    Phaser.Geom.Rectangle.Contains,
  );
  const onBgTint = toggleOptions?.onBgTint ?? 0xb8e0a8;
  const offBgTint = toggleOptions?.offBgTint ?? PALETTE.white;
  const onTextColor = toggleOptions?.onTextColor ?? "#d9f99d";
  const offTextColor = toggleOptions?.offTextColor ?? MEDIEVAL_LABEL.color;

  const colors = textured
    ? { rest: offBgTint, pressed: darkenTint(offBgTint) }
    : { rest: PALETTE.zinc700, pressed: PALETTE.zinc800 };
  bindPress(scene, container, onPress, {
    bg,
    colors,
    pressScale: 0.9,
    textured,
  });

  let onState = false;

  const applyOn = (on: boolean) => {
    onState = on;
    if (textured && isImageBg(bg)) {
      const rest = on ? onBgTint : offBgTint;
      colors.rest = rest;
      colors.pressed = darkenTint(rest);
      bg.setTint(rest);
      text.setColor(on ? onTextColor : offTextColor);
      return;
    }
    colors.rest = on ? PALETTE.green700 : PALETTE.zinc700;
    colors.pressed = darkenColor(colors.rest, 0.75);
    if (isUiRoundedRect(bg)) {
      const stroke = on ? PALETTE.green400 : PALETTE.zinc500;
      paintUiRoundedRect(bg, colors.rest, stroke);
    } else if (!isImageBg(bg) && bg instanceof Phaser.GameObjects.Rectangle) {
      bg.setFillStyle(colors.rest, 1);
      bg.setStrokeStyle(STROKE_PX, on ? PALETTE.green400 : PALETTE.zinc500);
    }
    text.setColor(on ? "#bbf7d0" : PALETTE_CSS.zinc200);
  };

  return {
    container,
    setLabel: (label: string) => {
      text.setText(label);
      if (label.includes("\n")) {
        text.setFontSize(scaleUiX(12));
        text.setLineSpacing(scaleUiX(-2));
      }
    },
    setOn: applyOn,
    getOn: () => onState,
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
  frameTextureKey?: string,
): Phaser.GameObjects.Container {
  const pad = scaleUiX(16);
  const hitR = radius + pad;
  const diameter = radius * 2;
  const textured = Boolean(frameTextureKey);
  const container = scene.add
    .container(Math.round(x), Math.round(y))
    .setDepth(depth)
    .setScrollFactor(0);

  let bg: BgVisual;
  if (frameTextureKey && scene.textures.exists(frameTextureKey)) {
    bg = scene.add
      .image(0, 0, frameTextureKey)
      .setDisplaySize(diameter, diameter);
  } else {
    bg = scene.add
      .circle(0, 0, radius, PALETTE.orange600, 1)
      .setStrokeStyle(STROKE_PX, 0xfdba74);
  }
  const text = scene.add
    .text(0, 0, label, {
      ...labelStyle(scene, `${scaleUiX(18)}px`, textured),
    })
    .setOrigin(0.5);
  container.add([bg, text]);

  container.setSize(hitR * 2, hitR * 2);
  container.setInteractive(
    new Phaser.Geom.Circle(hitR, hitR, hitR),
    Phaser.Geom.Circle.Contains,
  );
  const colors = textured
    ? { rest: PALETTE.white, pressed: darkenTint(PALETTE.white, 0.65) }
    : { rest: PALETTE.orange600, pressed: 0xc2410c };
  bindPress(scene, container, onPress, {
    bg,
    colors,
    pressScale: 0.9,
    textured,
  });
  return container;
}
