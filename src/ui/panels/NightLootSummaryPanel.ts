import type Phaser from "phaser";
import { GAME } from "../../config";
import type { NightLootSummary } from "../../gear/nightLootSummary";
import { isNightSummaryReturnKey } from "../../gear/nightLootSummary";
import type { GearCatalog } from "../../gear/gearTypes";
import type { SaveGame } from "../../core/save/saveTypes";
import { uiPartKey } from "../../content/uiParts";
import { playUiSfx } from "../../audio/uiSfx";
import { runDefenseUiFactory } from "../../world/defenseWorldAddHook";
import {
  createTouchButton,
  type TouchButtonHandle,
} from "../touch/touchButton";
import { frameTouchButton, hasUiPart } from "../layout/uiFrame";
import { DgKit, fitText, type Button, type Tap } from "../gearPanel/dgPanelKit";
import {
  nightDropCompare,
  nightDropRows,
  VERDICT_LABEL,
  VERDICT_PART,
  type DropVerdict,
  type NightDropRow,
  type NightTip,
} from "../gearPanel/nightDropView";
import { DG_THEME, hexToInt } from "../theme/dgTheme";
import type { UiIconName } from "../icons/uiIcons";

/** Kept drops on a won night: rows with verdicts, compare tooltip and Equip (swap). */
export type NightDropsContext = {
  catalog: GearCatalog;
  getSave: () => SaveGame;
  /** Equip `uid` (a swap), persist, and return the new save. */
  equip: (uid: number) => SaveGame;
  uids: readonly number[];
};

export type NightSummaryExtras = {
  drops?: NightDropsContext;
  /** Lost-night Tips (from {@link nightLossTips}). */
  tips?: readonly NightTip[];
};

const VERDICT_COLOR: Record<DropVerdict, string> = {
  better: DG_THEME.statePositive,
  worse: DG_THEME.stateNegative,
  mixed: DG_THEME.accentGoldBright,
  same: DG_THEME.textSecondary,
  new: "#FDE68A",
};

const VERDICT_LINE: Record<DropVerdict, string> = {
  better: "Every stat that changes gets better.",
  worse: "Every stat that changes gets worse.",
  mixed: "Some stats go up, some go down.",
  same: "No stat changes.",
  new: "Fills an empty slot.",
};

/** Pure layout of the night-end card (absolute canvas coordinates). */
export type NightSummaryLayout = {
  cardX: number;
  cardW: number;
  cardTop: number;
  cardH: number;
  innerL: number;
  innerW: number;
  centerX: number;
  titleY: number;
  flavorY: number;
  dividerY: number;
  stats: { y: number; h: number; w: number; gap: number };
  spoilsY: number;
  rows: { y: number; h: number; gap: number; count: number };
  emptyY: number | null;
  soldY: number | null;
  tips: { headerY: number; y: number; h: number; gap: number } | null;
  button: { y: number; w: number; h: number };
  hintY: number;
};

export const NIGHT_ROW_H = 64;
const ROW_GAP = 8;
const TIP_H = 56;

export function layoutNightLootSummary(
  summary: NightLootSummary,
  counts: { rows?: number; tips?: number } = {},
): NightSummaryLayout {
  const cardX = 16;
  const cardW = GAME.width - cardX * 2;
  const innerL = cardX + 22;
  const innerW = cardW - 44;
  const rowCount = counts.rows ?? summary.items.filter((i) => !i.sold).length;
  const tipCount = counts.tips ?? 0;
  let y = 50;
  const titleY = y;
  y += 40;
  const flavorY = y;
  y += 28;
  const dividerY = y;
  y += 16;
  const stats = { y, h: 74, w: (innerW - 16) / 3, gap: 8 };
  y += stats.h + 12;
  y += 4;
  const spoilsY = y;
  y += 22;
  const rows = { y, h: NIGHT_ROW_H, gap: ROW_GAP, count: rowCount };
  let emptyY: number | null = null;
  if (rowCount === 0) {
    emptyY = y;
    y += 56 + ROW_GAP;
  } else {
    y += rowCount * (NIGHT_ROW_H + ROW_GAP);
  }
  let soldY: number | null = null;
  if (summary.soldNote) {
    soldY = y;
    y += 26;
  }
  let tips: NightSummaryLayout["tips"] = null;
  if (tipCount > 0) {
    tips = { headerY: y + 4, y: y + 26, h: TIP_H, gap: ROW_GAP };
    y += 26 + tipCount * (TIP_H + ROW_GAP);
  }
  y += 8;
  const button = { y: y + 30, w: innerW, h: 60 };
  y += 60 + 10;
  const hintY = y;
  y += 30;
  const cardH = y;
  const cardTop = Math.max(56, Math.round((GAME.height - cardH) / 2));
  const off = (v: number) => cardTop + v;
  return {
    cardX,
    cardW,
    cardTop,
    cardH,
    innerL,
    innerW,
    centerX: GAME.width / 2,
    titleY: off(titleY),
    flavorY: off(flavorY),
    dividerY: off(dividerY),
    stats: { ...stats, y: off(stats.y) },
    spoilsY: off(spoilsY),
    rows: { ...rows, y: off(rows.y) },
    emptyY: emptyY === null ? null : off(emptyY),
    soldY: soldY === null ? null : off(soldY),
    tips: tips ? { ...tips, headerY: off(tips.headerY), y: off(tips.y) } : null,
    button: { ...button, y: off(button.y) },
    hintY: off(hintY),
  };
}

/**
 * Campaign night-end overlay (DG Theme): result medallion, gold / total / wall
 * plates, the night's kept drops (verdict, compare tooltip, Equip swap), the
 * auto-sold note, Tips on a lost night, and Back to Town (Enter / Space).
 * Built once; Equip only re-texts the rows, so the panel stays cheap to draw.
 */
export class NightLootSummaryPanel {
  readonly root: Phaser.GameObjects.Container;
  readonly returnBtn: TouchButtonHandle;
  private tornDown = false;
  private readonly unbindKeys: () => void;
  private readonly shutdownHandler: () => void;
  private readonly scene: Phaser.Scene;
  private readonly onReturnToTown: () => void;
  private readonly rows: DropRowView[] = [];
  private readonly drops: NightDropsContext | undefined;
  private tip: {
    layer: Phaser.GameObjects.Container;
    uid: number;
    pinned: boolean;
  } | null = null;

  constructor(
    scene: Phaser.Scene,
    summary: NightLootSummary,
    onReturnToTown: () => void,
    extras: NightSummaryExtras = {},
  ) {
    this.scene = scene;
    this.onReturnToTown = onReturnToTown;
    this.drops = extras.drops;
    const built = runDefenseUiFactory(scene, () => this.build(summary, extras));
    this.root = built.root;
    this.returnBtn = built.returnBtn;
    this.unbindKeys = bindReturnKeys(
      () => this.returnToTown(),
      () => this.tornDown,
    );
    this.shutdownHandler = () => this.destroy();
    scene.events.once("shutdown", this.shutdownHandler);
  }

  /** Screen centres of a drop row's "i" and Equip (e2e / screenshots). */
  dropTargets(): {
    uid: number;
    info: { x: number; y: number };
    equip: { x: number; y: number };
  }[] {
    return this.rows.map((r) => ({
      uid: r.uid,
      info: r.info.center(),
      equip: r.equip.tap.center(),
    }));
  }

  /** Open the compare tooltip for a kept drop (same as tapping its "i"). */
  openCompare(uid: number): void {
    this.showTip(uid, true);
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

  private build(
    summary: NightLootSummary,
    extras: NightSummaryExtras,
  ): { root: Phaser.GameObjects.Container; returnBtn: TouchButtonHandle } {
    const scene = this.scene;
    const root = scene.add.container(0, 0).setDepth(400).setScrollFactor(0);
    root.setData("testid", "defense-night-summary");
    root.add(
      scene.add.rectangle(
        GAME.width / 2,
        GAME.height / 2,
        GAME.width,
        GAME.height,
        0x0c0a09,
        0.8,
      ),
    );
    const kit = new DgKit(scene, root);
    const dropRows = extras.drops
      ? nightDropRows(
          extras.drops.catalog,
          extras.drops.getSave().gear,
          extras.drops.uids,
        )
      : null;
    const fallbackRows = summary.items.filter((i) => !i.sold);
    const tips = summary.won ? [] : (extras.tips ?? []);
    const L = layoutNightLootSummary(summary, {
      rows: dropRows ? dropRows.length : fallbackRows.length,
      tips: tips.length,
    });

    kit.box(L.cardX, L.cardTop, L.cardW, L.cardH, {
      fill: DG_THEME.bgPanel,
      stroke: DG_THEME.accentGold,
      strokeWidth: 2,
      radius: 10,
      frame: "ornate",
    });
    drawMedallion(
      kit,
      L.centerX,
      L.cardTop + 2,
      summary.won ? "shield" : "flame",
      summary.won,
    );

    const title = kit
      .text(L.centerX, L.titleY, summary.headline, {
        size: 28,
        title: true,
        color: summary.won ? DG_THEME.accentGoldBright : "#FCA5A5",
        originX: 0.5,
      })
      .setStroke("#000000", 4);
    kit.whenTitleFontReady(() => fitText(title, summary.headline, L.innerW));
    kit
      .text(L.centerX, L.flavorY, summary.flavor, {
        size: 13,
        color: DG_THEME.textSecondary,
        originX: 0.5,
        wrap: L.innerW,
      })
      .setAlign("center");
    drawDivider(kit, L.centerX, L.dividerY, L.innerW);

    // Gold earned / total gold / wall plates.
    const sx = (i: number) => L.innerL + i * (L.stats.w + L.stats.gap);
    statPlate(
      kit,
      sx(0),
      L.stats,
      summary.won ? "GOLD EARNED" : "GOLD SALVAGED",
    );
    coinValue(
      kit,
      sx(0),
      L.stats,
      `+${summary.goldEarned}`,
      DG_THEME.statePositive,
    );
    statPlate(kit, sx(1), L.stats, "TOTAL GOLD");
    coinValue(
      kit,
      sx(1),
      L.stats,
      `${summary.goldTotal}`,
      DG_THEME.accentGoldBright,
    );
    statPlate(kit, sx(2), L.stats, "WALL");
    wallValue(kit, sx(2), L.stats, summary);

    sectionLabel(kit, L.innerL, L.spoilsY, "SPOILS OF THE NIGHT");
    const count = dropRows ? dropRows.length : fallbackRows.length;
    kit.text(
      L.innerL + L.innerW,
      L.spoilsY + 6,
      count === 0
        ? "0 drops"
        : `${count} ${count === 1 ? "drop" : "drops"}${dropRows ? " · tap i to compare" : ""}`,
      { size: 11, color: DG_THEME.textMuted, originX: 1, originY: 0.5 },
    );

    if (L.emptyY !== null) {
      kit.box(L.innerL, L.emptyY, L.innerW, 56, {
        fill: DG_THEME.bgSlot,
        stroke: DG_THEME.borderIron,
        radius: 8,
        frame: "dark",
      });
      kit.icon(L.innerL + 34, L.emptyY + 28, "lock", 24, DG_THEME.textMuted);
      kit.text(
        L.innerL + 62,
        L.emptyY + 28,
        summary.emptyLootText ?? "No loot this night.",
        {
          size: 14,
          color: DG_THEME.textSecondary,
          originY: 0.5,
        },
      );
    } else if (dropRows) {
      dropRows.forEach((row, i) => {
        const y = L.rows.y + i * (L.rows.h + L.rows.gap);
        this.rows.push(this.dropRow(kit, L, y, row));
      });
    } else {
      fallbackRows.forEach((item, i) => {
        const y = L.rows.y + i * (L.rows.h + L.rows.gap);
        kit.box(L.innerL, y, L.innerW, L.rows.h, {
          fill: DG_THEME.bgSlot,
          radius: 8,
          frame: "dark",
        });
        kit.text(L.innerL + 16, y + L.rows.h / 2, `• ${item.name}`, {
          size: 16,
          color: item.color,
          originY: 0.5,
        });
      });
    }

    if (L.soldY !== null && summary.soldNote) {
      kit.icon(L.innerL + 10, L.soldY + 10, "coins", 16, DG_THEME.accentGold);
      kit.text(L.innerL + 24, L.soldY + 10, summary.soldNote, {
        size: 12,
        color: "#FCD34D",
        originY: 0.5,
        wrap: L.innerW - 24,
      });
    }

    if (L.tips) {
      sectionLabel(kit, L.innerL, L.tips.headerY, "TIPS");
      tips.forEach((tip, i) => {
        const y = (L.tips?.y ?? 0) + i * (TIP_H + ROW_GAP);
        tipRow(kit, L.innerL, y, L.innerW, tip);
      });
    }

    const returnBtn = createTouchButton(
      scene,
      L.centerX,
      L.button.y,
      "Back to Town",
      () => this.returnToTown(),
      {
        width: L.button.w,
        height: L.button.h,
        depth: 410,
        fontSize: "22px",
        fillColor: hexToInt(DG_THEME.buttonNeutral),
        strokeColor: hexToInt(DG_THEME.accentGold),
        tapPadding: 4,
      },
    );
    frameTouchButton(scene, returnBtn.container, "btn", L.button.w, L.button.h);
    returnBtn.container.setData("testid", "defense-return-to-town");
    kit.text(L.centerX, L.hintY, "Enter or Space", {
      size: 11,
      color: DG_THEME.textMuted,
      originX: 0.5,
    });
    return { root, returnBtn };
  }

  private dropRow(
    kit: DgKit,
    L: NightSummaryLayout,
    y: number,
    row: NightDropRow,
  ): DropRowView {
    const x = L.innerL;
    const h = L.rows.h;
    const box = kit.box(x, y, L.innerW, h, {
      fill: DG_THEME.bgSlot,
      radius: 8,
      frame: "dark",
    });
    kit.box(x + 8, y + 8, 48, 48, {
      fill: DG_THEME.bgSlot,
      stroke: row.color,
      strokeWidth: 2,
      radius: 6,
      frame: "slot",
    });
    kit.icon(x + 32, y + 32, row.tile.icon, 28);
    const name = kit.text(x + 66, y + 9, "", {
      size: 15,
      title: true,
      color: row.color,
    });
    const sub = kit.text(x + 66, y + 29, "", {
      size: 11,
      color: DG_THEME.textMuted,
    });
    const stat = kit.text(x + 66, y + 44, "", {
      size: 12,
      color: DG_THEME.textSecondary,
    });
    const vx = x + 296;
    const verdict = hasUiPart(this.scene, VERDICT_PART.better)
      ? this.scene.add.image(vx, y + 22, uiPartKey(VERDICT_PART.better))
      : null;
    if (verdict) kit.root.add(verdict);
    const verdictLabel = kit
      .text(vx, y + 53, "", {
        size: 10,
        bold: true,
        originX: 0.5,
        originY: 0.5,
      })
      .setLetterSpacing(1);
    // "i" compare button: dark disc, gold ring, pixel "i".
    const ix = x + 344;
    const ring = this.scene.add.graphics();
    ring.fillStyle(0x1a1613, 1).fillCircle(ix, y + 32, 17);
    ring
      .lineStyle(2, hexToInt(DG_THEME.accentGold), 1)
      .strokeCircle(ix, y + 32, 17);
    kit.root.add(ring);
    if (hasUiPart(this.scene, "dg-info-i")) {
      kit.root.add(
        this.scene.add
          .image(ix, y + 32, uiPartKey("dg-info-i"))
          .setDisplaySize(10, 24),
      );
    } else {
      kit.text(ix, y + 32, "i", {
        size: 18,
        title: true,
        color: DG_THEME.accentGold,
        originX: 0.5,
        originY: 0.5,
      });
    }
    const uid = row.uid;
    const info = kit.tap(ix - 22, y + 4, 44, h - 8, () => {
      playUiSfx(this.scene, "click");
      if (this.tip?.uid === uid && this.tip.pinned) this.hideTip();
      else this.showTip(uid, true);
    });
    info.zone.on("pointerover", () => {
      if (!this.tip) this.showTip(uid, false);
    });
    info.zone.on("pointerout", () => {
      if (this.tip && !this.tip.pinned && this.tip.uid === uid) this.hideTip();
    });
    const equip = kit.button(
      x + 368,
      y + 12,
      90,
      40,
      "Equip",
      "equip",
      null,
      () => this.equip(uid),
      { size: 15 },
    );
    const view: DropRowView = {
      uid,
      box,
      name,
      sub,
      stat,
      verdict,
      verdictLabel,
      info,
      equip,
    };
    paintDropRow(view, row);
    return view;
  }

  private equip(uid: number): void {
    const ctx = this.drops;
    if (!ctx || this.tornDown) return;
    const before = ctx.getSave();
    const next = ctx.equip(uid);
    if (next.gear !== before.gear) playUiSfx(this.scene, "equip");
    this.hideTip();
    this.refreshRows();
  }

  private refreshRows(): void {
    const ctx = this.drops;
    if (!ctx) return;
    const rows = nightDropRows(ctx.catalog, ctx.getSave().gear, ctx.uids);
    for (const view of this.rows) {
      const row = rows.find((r) => r.uid === view.uid);
      if (row) paintDropRow(view, row);
    }
  }

  private hideTip(): void {
    if (!this.tip) return;
    this.tip.layer.destroy();
    this.tip = null;
    this.returnBtn.container.setVisible(true).setInteractive();
  }

  /** Compare tooltip for a drop; pinned (tap) adds buttons + tap-outside close. */
  private showTip(uid: number, pinned: boolean): void {
    const ctx = this.drops;
    if (!ctx || this.tornDown) return;
    this.hideTip();
    const view = this.rows.find((r) => r.uid === uid);
    if (!view) return;
    const save = ctx.getSave();
    const row = nightDropRows(ctx.catalog, save.gear, [uid])[0];
    if (!row) return;
    const cmp = nightDropCompare(ctx.catalog, save.gear, uid);
    const scene = this.scene;
    const layer = scene.add.container(0, 0);
    this.root.add(layer);
    this.tip = { layer, uid, pinned };
    // Hide Back to Town (it sits above the card) while the tooltip is up.
    this.returnBtn.container.setVisible(false).disableInteractive();
    const kit = new DgKit(scene, layer);
    if (pinned) {
      kit.tap(0, 0, GAME.width, GAME.height, () => this.hideTip());
    }
    const shown = cmp.rows.slice(0, 10);
    const w = 508;
    const x = 16;
    const h = 150 + Math.max(1, shown.length) * 24 + (pinned ? 70 : 0);
    const below = view.box.y + view.box.h + 8;
    const top =
      below + h <= GAME.height - 8 ? below : Math.max(8, view.box.y - 8 - h);
    kit.box(x, top, w, h, {
      fill: DG_THEME.bgPanel,
      stroke: DG_THEME.accentGold,
      strokeWidth: 2,
      radius: 10,
      frame: "ornate",
    });
    // Swallow taps on the card body so only outside taps close it.
    if (pinned) kit.tap(x, top, w, h, () => {});
    const lx = x + 120;
    const rx = x + w - 120;
    kit
      .text(lx, top + 22, cmp.title.toUpperCase(), {
        size: 10,
        bold: true,
        color: DG_THEME.accentGold,
        originX: 0.5,
      })
      .setLetterSpacing(1);
    kit
      .text(rx, top + 22, row.equipped ? "WORN NOW" : "NEW DROP", {
        size: 10,
        bold: true,
        color: DG_THEME.accentGold,
        originX: 0.5,
      })
      .setLetterSpacing(1);
    const against = kit.text(lx, top + 42, cmp.against, {
      size: 14,
      title: true,
      color: cmp.againstColor,
      originX: 0.5,
    });
    fitText(against, cmp.against, 200);
    const mine = kit.text(rx, top + 42, row.name, {
      size: 14,
      title: true,
      color: row.color,
      originX: 0.5,
    });
    fitText(mine, row.name, 200);
    kit.text(x + w / 2, top + 44, "vs", {
      size: 12,
      color: DG_THEME.textMuted,
      originX: 0.5,
    });
    let y = top + 76;
    const col = {
      label: x + 24,
      now: x + 300,
      next: x + 380,
      change: x + w - 24,
    };
    for (const [text, cx, ox] of [
      ["STAT", col.label, 0],
      ["NOW", col.now, 1],
      ["NEW", col.next, 1],
      ["CHANGE", col.change, 1],
    ] as const) {
      kit.text(cx, y, text, {
        size: 10,
        bold: true,
        color: DG_THEME.accentGold,
        originX: ox,
      });
    }
    y += 22;
    if (shown.length === 0) {
      kit.text(col.label, y, "No stat changes.", {
        size: 13,
        color: DG_THEME.textSecondary,
      });
      y += 24;
    }
    for (const r of shown) {
      const c = r.better ? DG_THEME.statePositive : DG_THEME.stateNegative;
      kit.text(col.label, y, r.label, {
        size: 13,
        color: DG_THEME.textPrimary,
      });
      kit.text(col.now, y, r.from, {
        size: 13,
        color: DG_THEME.textSecondary,
        originX: 1,
      });
      kit.text(col.next, y, r.to, { size: 13, color: c, originX: 1 });
      kit.text(col.change, y, r.delta, { size: 13, color: c, originX: 1 });
      y += 24;
    }
    y += 8;
    const verdict = row.equipped ? null : row.verdict;
    kit.text(
      col.label,
      y,
      verdict
        ? `${VERDICT_LABEL[verdict]}. ${VERDICT_LINE[verdict]}`
        : "Worn now. Equipping another drop swaps it back to the bag.",
      {
        size: 13,
        color: verdict ? VERDICT_COLOR[verdict] : DG_THEME.textSecondary,
        wrap: w - 48,
      },
    );
    if (pinned) {
      const by = top + h - 62;
      const bw = (w - 48 - 12) / 2;
      if (row.equipped) {
        kit.button(
          x + 24,
          by,
          w - 48,
          44,
          "Close",
          "neutral",
          null,
          () => this.hideTip(),
          { size: 16 },
        );
      } else {
        kit.button(
          x + 24,
          by,
          bw,
          44,
          "Keep current",
          "neutral",
          null,
          () => this.hideTip(),
          { size: 16 },
        );
        kit.button(
          x + 36 + bw,
          by,
          bw,
          44,
          "Equip",
          "equip",
          null,
          () => this.equip(uid),
          { size: 16 },
        );
      }
    }
  }
}

type DropRowView = {
  uid: number;
  box: ReturnType<DgKit["box"]>;
  name: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
  stat: Phaser.GameObjects.Text;
  verdict: Phaser.GameObjects.Image | null;
  verdictLabel: Phaser.GameObjects.Text;
  info: Tap;
  equip: Button;
};

function paintDropRow(view: DropRowView, row: NightDropRow): void {
  fitText(view.name, row.name, 220);
  fitText(view.sub, row.sub, 220);
  fitText(view.stat, row.stat, 220);
  const v = row.equipped ? null : row.verdict;
  if (view.verdict) {
    view.verdict.setVisible(v !== null);
    if (v) {
      const part = VERDICT_PART[v];
      view.verdict.setTexture(uiPartKey(part));
      view.verdict.setDisplaySize(40, 40);
    }
  }
  view.verdictLabel.setText(v ? VERDICT_LABEL[v].toUpperCase() : "WORN");
  view.verdictLabel.setColor(v ? VERDICT_COLOR[v] : DG_THEME.textMuted);
  // Equip is a swap: always available unless this drop is already worn.
  view.equip.set(
    row.equipped
      ? { label: "Worn", style: "neutral", enabled: false }
      : { label: "Equip", style: "equip", enabled: true },
  );
}

function drawMedallion(
  kit: DgKit,
  cx: number,
  cy: number,
  icon: UiIconName,
  won: boolean,
): void {
  const g = kit.scene.add.graphics();
  g.fillStyle(0x1a1613, 1).fillEllipse(cx, cy, 64, 74);
  g.lineStyle(4, hexToInt(DG_THEME.accentGold), 1).strokeEllipse(
    cx,
    cy,
    64,
    74,
  );
  g.lineStyle(1, 0x000000, 0.8).strokeEllipse(cx, cy, 72, 82);
  g.fillStyle(won ? 0x2a211a : 0x3b1218, 1).fillEllipse(cx, cy, 48, 58);
  kit.root.add(g);
  kit.icon(cx, cy, icon, 30, won ? DG_THEME.accentGoldBright : "#FCA5A5");
}

function drawDivider(kit: DgKit, cx: number, y: number, w: number): void {
  const g = kit.scene.add.graphics();
  const gold = hexToInt(DG_THEME.accentGold);
  g.lineStyle(2, gold, 0.8);
  g.lineBetween(cx - w / 2 + 20, y, cx - 14, y);
  g.lineBetween(cx + 14, y, cx + w / 2 - 20, y);
  g.fillStyle(gold, 1).fillTriangle(cx - 8, y, cx, y - 8, cx + 8, y);
  g.fillTriangle(cx - 8, y, cx, y + 8, cx + 8, y);
  g.fillStyle(0x9f1d2b, 1).fillRect(cx - 2, y - 2, 4, 4);
  kit.root.add(g);
}

function sectionLabel(kit: DgKit, x: number, y: number, text: string): void {
  kit
    .text(x, y + 6, text, {
      size: 11,
      bold: true,
      color: DG_THEME.accentGold,
      originY: 0.5,
    })
    .setLetterSpacing(1.5);
}

function statPlate(
  kit: DgKit,
  x: number,
  s: { y: number; h: number; w: number },
  label: string,
): void {
  kit.box(x, s.y, s.w, s.h, {
    fill: DG_THEME.bgSlot,
    stroke: DG_THEME.borderIron,
    radius: 6,
    frame: "dark",
  });
  kit
    .text(x + 12, s.y + 14, label, {
      size: 10,
      bold: true,
      color: DG_THEME.accentGold,
      originY: 0.5,
    })
    .setLetterSpacing(1);
}

function coinValue(
  kit: DgKit,
  x: number,
  s: { y: number; h: number },
  value: string,
  color: string,
): void {
  const cy = s.y + 46;
  if (hasUiPart(kit.scene, "dg-coin")) {
    kit.root.add(
      kit.scene.add
        .image(x + 22, cy, uiPartKey("dg-coin"))
        .setDisplaySize(21, 20),
    );
  } else {
    kit.icon(x + 22, cy, "coins", 18, DG_THEME.accentGold);
  }
  kit
    .text(x + 38, cy, value, {
      size: 24,
      title: true,
      color,
      originY: 0.5,
    })
    .setStroke("#000000", 3);
}

function wallValue(
  kit: DgKit,
  x: number,
  s: { y: number; h: number; w: number },
  summary: NightLootSummary,
): void {
  const hp = kit
    .text(x + 12, s.y + 38, `${summary.wallHp}`, {
      size: 22,
      title: true,
      color: summary.wallHp > 0 ? DG_THEME.textPrimary : DG_THEME.stateNegative,
      originY: 0.5,
    })
    .setStroke("#000000", 3);
  kit.text(x + 16 + hp.width, s.y + 40, `/ ${summary.wallHpMax} HP`, {
    size: 11,
    color: DG_THEME.textSecondary,
    originY: 0.5,
  });
  const bx = x + 12;
  const bw = s.w - 24;
  const by = s.y + 54;
  const g = kit.scene.add.graphics();
  g.fillStyle(0x000000, 0.7).fillRect(bx, by, bw, 10);
  const fw = Math.round((bw - 4) * summary.wallRatio);
  if (fw > 0) g.fillStyle(summary.wallFill, 1).fillRect(bx + 2, by + 2, fw, 6);
  g.lineStyle(1, hexToInt(DG_THEME.accentGold), 1).strokeRect(bx, by, bw, 10);
  kit.root.add(g);
}

function tipRow(
  kit: DgKit,
  x: number,
  y: number,
  w: number,
  tip: NightTip,
): void {
  kit.box(x, y, w, TIP_H, {
    fill: DG_THEME.bgSlot,
    radius: 8,
    frame: "dark",
  });
  const g = kit.scene.add.graphics();
  g.fillStyle(0x1a1613, 1).fillEllipse(x + 30, y + TIP_H / 2, 34, 40);
  g.lineStyle(2, hexToInt(DG_THEME.accentGold), 1).strokeEllipse(
    x + 30,
    y + TIP_H / 2,
    34,
    40,
  );
  kit.root.add(g);
  kit.icon(x + 30, y + TIP_H / 2, tip.icon, 18, DG_THEME.accentGoldBright);
  kit.text(x + 58, y + 12, tip.title, {
    size: 15,
    title: true,
    color: DG_THEME.textPrimary,
  });
  const body = kit.text(x + 58, y + 33, "", {
    size: 11,
    color: DG_THEME.textSecondary,
  });
  fitText(body, tip.body, w - 70);
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
