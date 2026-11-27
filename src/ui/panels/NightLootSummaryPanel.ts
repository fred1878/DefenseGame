import type Phaser from "phaser";
import { PALETTE, PALETTE_CSS } from "../theme/uiPalette";
import { GAME } from "../../config";
import { scaleUiX, scaleUiY } from "../../config/uiScale";
import type { NightLootSummary } from "../../gear/nightLootSummary";
import { isNightSummaryReturnKey } from "../../gear/nightLootSummary";
import { runDefenseUiFactory } from "../../world/defenseWorldAddHook";
import {
  createTouchButton,
  type TouchButtonHandle,
} from "../touch/touchButton";
import { createUiRoundedRect } from "../layout/uiRoundedRect";
import { uiTextStyle } from "../layout/uiTextStyle";

/**
 * Campaign night-end overlay: result, gold, rarity-coloured loot, wall HP,
 * and the Back to Town button. Endless / planner runs do not use this panel.
 */
export class NightLootSummaryPanel {
  readonly root: Phaser.GameObjects.Container;
  readonly returnBtn: TouchButtonHandle;
  private tornDown = false;
  private readonly unbindKeys: () => void;
  private readonly shutdownHandler: () => void;
  private readonly scene: Phaser.Scene;
  private readonly onReturnToTown: () => void;

  constructor(
    scene: Phaser.Scene,
    summary: NightLootSummary,
    onReturnToTown: () => void,
  ) {
    this.scene = scene;
    this.onReturnToTown = onReturnToTown;
    const built = runDefenseUiFactory(scene, () =>
      buildNightLootSummary(scene, summary, () => this.returnToTown()),
    );
    this.root = built.root;
    this.returnBtn = built.returnBtn;
    this.unbindKeys = bindReturnKeys(
      () => this.returnToTown(),
      () => this.tornDown,
    );
    this.shutdownHandler = () => this.destroy();
    scene.events.once("shutdown", this.shutdownHandler);
  }

  private returnToTown(): void {
    if (this.tornDown) return;
    const go = this.onReturnToTown;
    this.destroy();
    go();
  }

  destroy(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.unbindKeys();
    this.scene.events.off("shutdown", this.shutdownHandler);
    this.root.destroy();
    if (this.returnBtn.container.active !== false) {
      this.returnBtn.container.destroy();
    }
  }
}

function bindReturnKeys(
  onReturn: () => void,
  isTornDown: () => boolean,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: KeyboardEvent) => {
    if (isTornDown()) return;
    if (!isNightSummaryReturnKey(event)) return;
    event.preventDefault();
    onReturn();
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

/** One text line of the summary card (content-local coordinates). */
export type NightSummaryLabel = {
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
  originX?: number;
  align?: "center";
  wrapWidth?: number;
};

/** Pure layout of the night summary card; {@link buildNightLootSummary} renders it. */
export type NightSummaryLayout = {
  cardW: number;
  cardH: number;
  cardTop: number;
  pad: number;
  centerX: number;
  labels: NightSummaryLabel[];
  wallBar: {
    y: number;
    h: number;
    left: number;
    w: number;
    fillW: number;
    fillColor: number;
  };
  button: { localY: number; w: number; h: number };
};

export function layoutNightLootSummary(
  summary: NightLootSummary,
): NightSummaryLayout {
  const margin = scaleUiX(20);
  const cardW = GAME.width - margin * 2;
  const pad = scaleUiX(20);
  const innerW = cardW - pad * 2;
  const innerLeft = (GAME.width - innerW) / 2;
  const innerRight = innerLeft + innerW;
  const centerX = GAME.width / 2;
  const labels: NightSummaryLabel[] = [];
  let y = 0;

  const centered = (text: string, size: number, color: string) =>
    labels.push({
      x: centerX,
      y,
      text,
      size,
      color,
      originX: 0.5,
      align: "center",
      wrapWidth: innerW,
    });
  const left = (text: string, size: number, color: string, wrap = false) =>
    labels.push({
      x: innerLeft,
      y,
      text,
      size,
      color,
      ...(wrap ? { wrapWidth: innerW } : {}),
    });
  const right = (text: string, size: number, color: string) =>
    labels.push({ x: innerRight, y, text, size, color, originX: 1 });

  centered(
    summary.headline,
    24,
    summary.won ? PALETTE_CSS.amber400 : PALETTE_CSS.red300,
  );
  y += scaleUiY(36);
  centered(summary.flavor, 14, PALETTE_CSS.zinc400);
  y += scaleUiY(36);
  if (summary.progressNote) {
    centered(summary.progressNote, 13, PALETTE_CSS.zinc400);
    y += scaleUiY(40);
  }

  const row = (label: string, value: string, valueColor: string) => {
    left(label, 15, PALETTE_CSS.zinc300);
    right(value, 15, valueColor);
    y += scaleUiY(26);
  };
  row("Gold earned", summary.goldEarnedText, PALETTE_CSS.amber400);
  row("Total gold", summary.goldTotalText, PALETTE_CSS.zinc50);
  y += scaleUiY(8);

  left("Loot", 15, PALETTE_CSS.zinc300);
  y += scaleUiY(26);
  if (summary.emptyLootText) {
    left(summary.emptyLootText, 15, PALETTE_CSS.zinc500);
    y += scaleUiY(26);
  } else {
    for (const item of summary.items) {
      const soldSuffix = item.sold ? " (sold)" : "";
      left(`• ${item.name}${soldSuffix}`, 16, item.color, true);
      y += scaleUiY(26);
    }
  }

  if (summary.soldNote) {
    y += scaleUiY(4);
    left(summary.soldNote, 13, "#fcd34d", true);
    y += scaleUiY(40);
  } else {
    y += scaleUiY(12);
  }

  left("Wall", 15, PALETTE_CSS.zinc300);
  right(summary.wallText, 15, PALETTE_CSS.zinc50);
  y += scaleUiY(28);

  const barH = scaleUiY(14);
  const wallBar = {
    y,
    h: barH,
    left: innerLeft,
    w: innerW,
    fillW: Math.max(0, innerW * summary.wallRatio),
    fillColor: summary.wallFill,
  };
  y += barH + scaleUiY(28);

  const btnH = scaleUiY(52);
  const button = { localY: y + btnH / 2, w: innerW, h: btnH };
  y += btnH + scaleUiY(16);

  labels.push({
    x: centerX,
    y,
    text: "Enter or Space",
    size: 12,
    color: PALETTE_CSS.zinc500,
    originX: 0.5,
  });
  y += scaleUiY(20);

  const cardH = y + pad * 2;
  const cardTop = Math.max(
    scaleUiY(72),
    Math.round((GAME.height - cardH) / 2) - scaleUiY(40),
  );
  return { cardW, cardH, cardTop, pad, centerX, labels, wallBar, button };
}

function renderLabel(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  l: NightSummaryLabel,
): void {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontSize: `${scaleUiX(l.size)}px`,
    color: l.color,
  };
  if (l.align) style.align = l.align;
  if (l.wrapWidth !== undefined) style.wordWrap = { width: l.wrapWidth };
  const t = scene.add.text(l.x, l.y, l.text, uiTextStyle(scene, style));
  if (l.originX !== undefined) t.setOrigin(l.originX, 0);
  parent.add(t);
}

function buildNightLootSummary(
  scene: Phaser.Scene,
  summary: NightLootSummary,
  onReturn: () => void,
): {
  root: Phaser.GameObjects.Container;
  returnBtn: TouchButtonHandle;
} {
  const root = scene.add.container(0, 0).setDepth(400).setScrollFactor(0);
  root.setData("testid", "defense-night-summary");

  const dim = scene.add.rectangle(
    GAME.width / 2,
    GAME.height / 2,
    GAME.width,
    GAME.height,
    PALETTE.zinc950,
    0.78,
  );
  root.add(dim);

  const L = layoutNightLootSummary(summary);
  const content = scene.add.container(0, 0).setScrollFactor(0);
  for (const label of L.labels) renderLabel(scene, content, label);

  const bar = L.wallBar;
  content.add(
    scene.add.rectangle(
      L.centerX,
      bar.y + bar.h / 2,
      bar.w,
      bar.h,
      PALETTE.zinc700,
      1,
    ),
  );
  if (bar.fillW > 0) {
    content.add(
      scene.add.rectangle(
        bar.left + bar.fillW / 2,
        bar.y + bar.h / 2,
        bar.fillW,
        bar.h,
        bar.fillColor,
        1,
      ),
    );
  }
  content.setPosition(0, L.cardTop + L.pad);

  const card = createUiRoundedRect(
    scene,
    L.cardW,
    L.cardH,
    0x18181b,
    PALETTE.zinc600,
  );
  card.setPosition(L.centerX, L.cardTop + L.cardH / 2).setScrollFactor(0);
  root.add(card);
  root.add(content);

  const returnBtn = createTouchButton(
    scene,
    L.centerX,
    L.cardTop + L.pad + L.button.localY,
    "Back to Town",
    onReturn,
    {
      width: L.button.w,
      height: L.button.h,
      depth: 410,
      fontSize: `${scaleUiX(18)}px`,
      fillColor: PALETTE.green700,
      strokeColor: PALETTE.green400,
    },
  );
  returnBtn.container.setData("testid", "defense-return-to-town");

  return { root, returnBtn };
}
