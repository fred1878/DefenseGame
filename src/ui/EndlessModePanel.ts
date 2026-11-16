import Phaser from "phaser";
import { GAME } from "../config";
import type { DataStore } from "../core/DataStore";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { listPlayableDefenseEnemyIds } from "../systems/endlessEnemyRoster";
import {
  createTouchButton,
  interactiveObjectScreenRect,
} from "./touchButton";
import { uiTextStyle } from "./uiTextStyle";

type EnemyRow = {
  enemyId: string;
  label: string;
  bg: Phaser.GameObjects.Rectangle;
};

/**
 * Town overlay: pick an enemy roster entry, then start endless defense.
 */
export class EndlessModePanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly rows: EnemyRow[] = [];
  private selectedId: string | null = null;
  private startBtn: ReturnType<typeof createTouchButton> | null = null;
  private readonly onStart: (enemyId: string) => void;

  constructor(
    scene: Phaser.Scene,
    store: DataStore,
    onStart: (enemyId: string) => void,
  ) {
    this.onStart = onStart;

    const enemyIds = listPlayableDefenseEnemyIds(store);
    if (enemyIds.length === 0) enemyIds.push("grunt");

    this.root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);

    const dim = scene.add
      .rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x000000, 0.72);
    this.root.add(dim);

    const title = scene.add
      .text(
        GAME.width / 2,
        scaleUiY(64),
        "Endless training",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(24)}px`,
          color: "#f4f4f5",
        }),
      )
      .setOrigin(0.5);
    this.root.add(title);

    const hint = scene.add
      .text(
        GAME.width / 2,
        scaleUiY(98),
        "Pick a foe — one at a time until you fall or leave. No gold, no night advance.",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(13)}px`,
          color: "#a1a1aa",
          align: "center",
          wordWrap: { width: GAME.width - scaleUiX(36) },
        }),
      )
      .setOrigin(0.5, 0);
    this.root.add(hint);

    const rowW = GAME.width - scaleUiX(48);
    const rowH = scaleUiY(44);
    const gap = scaleUiY(8);
    let y = scaleUiY(148);

    for (const enemyId of enemyIds) {
      const def = store.enemies[enemyId];
      const label = def?.displayName ?? enemyId;
      const bg = scene.add
        .rectangle(GAME.width / 2, y + rowH / 2, rowW, rowH, 0x3f3f46, 1)
        .setStrokeStyle(2, 0x71717a);
      const text = scene.add
        .text(GAME.width / 2, y + rowH / 2, label, uiTextStyle(scene, {
          fontSize: `${scaleUiX(16)}px`,
          color: "#fafafa",
        }))
        .setOrigin(0.5);
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerup", () => this.select(enemyId));
      this.rows.push({ enemyId, label, bg });
      this.root.add([bg, text]);
      y += rowH + gap;
    }

    this.selectedId = enemyIds[0] ?? null;
    this.refreshSelection();

    const startY = Math.min(y + scaleUiY(16), GAME.height - scaleUiY(120));
    this.startBtn = createTouchButton(
      scene,
      GAME.width / 2,
      startY,
      "Start endless",
      () => {
        if (!this.selectedId) return;
        this.onStart(this.selectedId);
        this.destroy();
      },
      {
        width: scaleUiX(200),
        height: scaleUiY(48),
        depth: 510,
        fontSize: `${scaleUiX(16)}px`,
        fillColor: 0x1d4ed8,
        strokeColor: 0x93c5fd,
      },
    );
    this.root.add(this.startBtn.container);

    const closeBtn = createTouchButton(
      scene,
      GAME.width / 2,
      startY + scaleUiY(60),
      "Close",
      () => this.destroy(),
      {
        width: scaleUiX(120),
        height: scaleUiY(40),
        depth: 510,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x52525b,
        strokeColor: 0xa1a1aa,
      },
    );
    this.root.add(closeBtn.container);
  }

  private select(enemyId: string): void {
    this.selectedId = enemyId;
    this.refreshSelection();
  }

  private refreshSelection(): void {
    for (const row of this.rows) {
      const on = row.enemyId === this.selectedId;
      row.bg.setFillStyle(on ? 0x1e3a5f : 0x3f3f46);
      row.bg.setStrokeStyle(2, on ? 0x60a5fa : 0x71717a);
    }
  }

  destroy(): void {
    this.startBtn?.container.destroy();
    this.root.destroy();
  }

  e2eTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    for (const row of this.rows) {
      const r = interactiveObjectScreenRect(row.bg);
      if (!r) continue;
      out[`endless-enemy-${row.enemyId}`] = {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      };
    }
    if (this.startBtn) {
      const r = interactiveObjectScreenRect(this.startBtn.container);
      if (r) {
        out["endless-start"] = {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
        };
      }
    }
    return out;
  }

  e2eStartWithEnemy(enemyId: string): void {
    this.select(enemyId);
    this.onStart(enemyId);
    this.destroy();
  }
}