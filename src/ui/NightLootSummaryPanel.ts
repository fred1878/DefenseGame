import type Phaser from "phaser";
import { GAME } from "../config";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import type { NightLootSummary } from "../gear/nightLootSummary";
import { isNightSummaryReturnKey } from "../gear/nightLootSummary";
import { runDefenseUiFactory } from "../world/defenseWorldAddHook";
import { createTouchButton, type TouchButtonHandle } from "./touchButton";
import { createUiRoundedRect } from "./uiRoundedRect";
import { uiTextStyle } from "./uiTextStyle";

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

function addLabel(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  text: string,
  size: number,
  color: string,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(
    x,
    y,
    text,
    uiTextStyle(scene, {
      fontSize: `${scaleUiX(size)}px`,
      color,
      ...extra,
    }),
  );
  parent.add(t);
  return t;
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
    0x09090b,
    0.78,
  );
  root.add(dim);

  const margin = scaleUiX(20);
  const cardW = GAME.width - margin * 2;
  const pad = scaleUiX(20);
  const innerW = cardW - pad * 2;
  const innerLeft = (GAME.width - innerW) / 2;
  const innerRight = innerLeft + innerW;
  const centerX = GAME.width / 2;

  const content = scene.add.container(0, 0).setScrollFactor(0);
  const headlineColor = summary.won ? "#fbbf24" : "#fca5a5";
  let y = 0;

  addLabel(scene, content, centerX, y, summary.headline, 24, headlineColor, {
    align: "center",
    wordWrap: { width: innerW },
  }).setOrigin(0.5, 0);
  y += scaleUiY(36);

  addLabel(scene, content, centerX, y, summary.flavor, 14, "#a1a1aa", {
    align: "center",
    wordWrap: { width: innerW },
  }).setOrigin(0.5, 0);
  y += scaleUiY(36);

  if (summary.progressNote) {
    addLabel(scene, content, centerX, y, summary.progressNote, 13, "#a1a1aa", {
      align: "center",
      wordWrap: { width: innerW },
    }).setOrigin(0.5, 0);
    y += scaleUiY(40);
  }

  const addRow = (label: string, value: string, valueColor: string) => {
    addLabel(scene, content, innerLeft, y, label, 15, "#d4d4d8");
    addLabel(scene, content, innerRight, y, value, 15, valueColor).setOrigin(
      1,
      0,
    );
    y += scaleUiY(26);
  };
  addRow("Gold earned", summary.goldEarnedText, "#fbbf24");
  addRow("Total gold", summary.goldTotalText, "#fafafa");
  y += scaleUiY(8);

  addLabel(scene, content, innerLeft, y, "Loot", 15, "#d4d4d8");
  y += scaleUiY(26);

  if (summary.emptyLootText) {
    addLabel(
      scene,
      content,
      innerLeft,
      y,
      summary.emptyLootText,
      15,
      "#71717a",
    );
    y += scaleUiY(26);
  } else {
    for (const item of summary.items) {
      const soldSuffix = item.sold ? " (sold)" : "";
      addLabel(
        scene,
        content,
        innerLeft,
        y,
        `• ${item.name}${soldSuffix}`,
        16,
        item.color,
        { wordWrap: { width: innerW } },
      );
      y += scaleUiY(26);
    }
  }

  if (summary.soldNote) {
    y += scaleUiY(4);
    addLabel(scene, content, innerLeft, y, summary.soldNote, 13, "#fcd34d", {
      wordWrap: { width: innerW },
    });
    y += scaleUiY(40);
  } else {
    y += scaleUiY(12);
  }

  addLabel(scene, content, innerLeft, y, "Wall", 15, "#d4d4d8");
  addLabel(
    scene,
    content,
    innerRight,
    y,
    summary.wallText,
    15,
    "#fafafa",
  ).setOrigin(1, 0);
  y += scaleUiY(28);

  const barH = scaleUiY(14);
  const barBg = scene.add.rectangle(
    centerX,
    y + barH / 2,
    innerW,
    barH,
    0x3f3f46,
    1,
  );
  content.add(barBg);
  const fillW = Math.max(0, innerW * summary.wallRatio);
  if (fillW > 0) {
    const barFill = scene.add.rectangle(
      innerLeft + fillW / 2,
      y + barH / 2,
      fillW,
      barH,
      summary.wallFill,
      1,
    );
    content.add(barFill);
  }
  y += barH + scaleUiY(28);

  const btnW = innerW;
  const btnH = scaleUiY(52);
  const btnLocalY = y + btnH / 2;
  y += btnH + scaleUiY(16);

  addLabel(
    scene,
    content,
    centerX,
    y,
    "Enter or Space",
    12,
    "#71717a",
  ).setOrigin(0.5, 0);
  y += scaleUiY(20);

  const cardH = y + pad * 2;
  const cardTop = Math.max(
    scaleUiY(72),
    Math.round((GAME.height - cardH) / 2) - scaleUiY(40),
  );
  content.setPosition(0, cardTop + pad);

  const card = createUiRoundedRect(scene, cardW, cardH, 0x18181b, 0x52525b);
  card.setPosition(centerX, cardTop + cardH / 2).setScrollFactor(0);
  root.add(card);
  root.add(content);

  const returnBtn = createTouchButton(
    scene,
    centerX,
    cardTop + pad + btnLocalY,
    "Back to Town",
    onReturn,
    {
      width: btnW,
      height: btnH,
      depth: 410,
      fontSize: `${scaleUiX(18)}px`,
      fillColor: 0x15803d,
      strokeColor: 0x4ade80,
    },
  );
  returnBtn.container.setData("testid", "defense-return-to-town");

  return { root, returnBtn };
}
