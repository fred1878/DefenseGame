import type Phaser from "phaser";
import { DG_THEME as SHARED_THEME, themeInt } from "./theme/dgTheme";
import { GAME } from "../config";
import { DAMAGE_NUMBER_FONT_FAMILY } from "../config/damageNumbers";
import { UI_TEXTURE } from "../content/assets";
import type { SaveGame } from "../core/saveTypes";
import { INPUT_MODALITY } from "../input/inputModality";
import {
  acquireModalInput,
  bindModalDimBackdrop,
  type ModalInputLease,
} from "../input/modalBackdrop";
import { getTalentCatalog } from "../talents/talentCatalog";
import {
  branchPointsSpent,
  canLearn,
  canResetTalents,
  choiceTakenElsewhere,
  findTalent,
  learnTalent,
  lockReason,
  nodeState,
  pointsAvailable,
  pointsSpent,
  resetTalents,
  talentRank,
  tierThreshold,
  type TalentLocation,
} from "../talents/talentLogic";
import {
  nextTierProgress,
  pointsSubtitle,
  rankLabel,
  talentDescription,
  talentDiffRows,
  talentProcLines,
  tierNumeral,
} from "../talents/talentText";
import type {
  SaveTalents,
  TalentCatalog,
  TalentNodeState,
} from "../talents/talentTypes";
import { ensureTalentIcons, talentIconKey } from "./talentPanel/talentIcons";
import {
  layoutTalentTree,
  TALENT_LAYOUT as L,
  type TalentTreeLayout,
} from "./talentPanel/talentPanelLayout";
import { createTouchButton, interactiveObjectScreenRect } from "./touchButton";
import { UI_FONT_FAMILY, uiTextStyle } from "./uiTextStyle";

type Button = ReturnType<typeof createTouchButton>;

/** "DG Theme" colours from the Figma file. */
/** Talent panel palette, taken from the shared DG Theme (Figma variables). */
const DG = {
  abyss: themeInt("bgAbyss"),
  panel: themeInt("bgPanel"),
  raised: themeInt("bgRaised"),
  slot: themeInt("bgSlot"),
  selected: themeInt("bgSelected"),
  iron: themeInt("borderIron"),
  steel: themeInt("borderSteel"),
  gold: themeInt("accentGold"),
  goldBright: themeInt("accentGoldBright"),
  crimson: themeInt("accentCrimson"),
  arcane: themeInt("schoolArcane"),
  buy: themeInt("buttonBuy"),
  neutral: themeInt("buttonNeutral"),
  text: SHARED_THEME.textPrimary,
  textSecondary: SHARED_THEME.textSecondary,
  textMuted: SHARED_THEME.textMuted,
  goldText: SHARED_THEME.accentGold,
  goldBrightText: SHARED_THEME.accentGoldBright,
  positive: SHARED_THEME.statePositive,
  arcaneText: SHARED_THEME.schoolArcane,
} as const;

const PIXEL_FONT = `"${DAMAGE_NUMBER_FONT_FAMILY}", ${UI_FONT_FAMILY}`;
const DISABLED_ALPHA = 0.45;

type NodeView = {
  loc: TalentLocation;
  x: number;
  y: number;
  icon: Phaser.GameObjects.Image | null;
  rank: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  note: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Rectangle;
};

type BranchView = {
  name: Phaser.GameObjects.Text;
  spent: Phaser.GameObjects.Text;
};

type DiffView = {
  label: Phaser.GameObjects.Text;
  from: Phaser.GameObjects.Text;
  to: Phaser.GameObjects.Text;
  delta: Phaser.GameObjects.Text;
};

const STATE_RING: Record<TalentNodeState, { fill: number; stroke: number }> = {
  locked: { fill: DG.slot, stroke: DG.iron },
  available: { fill: DG.raised, stroke: DG.goldBright },
  partial: { fill: DG.raised, stroke: DG.gold },
  maxed: { fill: DG.selected, stroke: DG.gold },
};

/**
 * Town overlay for the talent tree (Figma "Talent Tree" frame): three branch
 * columns of five tiers, gold connectors along learned paths, a detail panel
 * for the selected talent, and Learn / Reset.
 */
export class TalentPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly modalLease: ModalInputLease;
  private readonly catalog: TalentCatalog;
  private readonly layout: TalentTreeLayout;
  private readonly chrome: Phaser.GameObjects.Graphics;
  private readonly tree: Phaser.GameObjects.Graphics;
  private readonly pointsPill: Phaser.GameObjects.Text;
  private readonly summary: Phaser.GameObjects.Text;
  private readonly nodes: NodeView[] = [];
  private readonly branches: BranchView[] = [];
  private readonly detailName: Phaser.GameObjects.Text;
  private readonly detailRank: Phaser.GameObjects.Text;
  private readonly detailDesc: Phaser.GameObjects.Text;
  private readonly diffs: DiffView[] = [];
  private readonly procText: Phaser.GameObjects.Text;
  private readonly tierLeft: Phaser.GameObjects.Text;
  private readonly tierRight: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly pixelTexts: Phaser.GameObjects.Text[] = [];
  private readonly learnBtn: Button;
  private readonly resetBtn: Button;
  private readonly closeBtn: Button;
  private readonly onTextureAdded = (): void => this.refreshIcons();
  private selectedId: string;
  private resetArmed = false;
  private tornDown = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getSave: () => SaveGame,
    private readonly onSaveChange: (save: SaveGame) => void,
    private readonly onDismiss?: () => void,
    catalog: TalentCatalog = getTalentCatalog(),
  ) {
    this.catalog = catalog;
    this.layout = layoutTalentTree(catalog, GAME.width, GAME.height);
    const root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);
    this.root = root;
    const dim = scene.add.rectangle(
      GAME.width / 2,
      GAME.height / 2,
      GAME.width,
      GAME.height,
      DG.abyss,
      0.97,
    );
    bindModalDimBackdrop(dim);
    root.add(dim);
    this.modalLease = acquireModalInput(scene, INPUT_MODALITY.townTalents);

    this.chrome = scene.add.graphics();
    this.tree = scene.add.graphics();
    root.add([this.chrome, this.tree]);
    this.drawChrome();

    const W = GAME.width;
    const headerMid = L.headerY + L.headerH / 2;
    if (scene.textures.exists(UI_TEXTURE.atkCircle)) {
      root.add(
        scene.add
          .image(L.pad + 16 + 26, headerMid, UI_TEXTURE.atkCircle)
          .setDisplaySize(52, 52),
      );
    }
    this.text(L.pad + 84, headerMid - 14, "Talents", 26, DG.text, true)
      .setOrigin(0, 0.5)
      .setFontStyle("bold");
    this.text(
      L.pad + 84,
      headerMid + 16,
      pointsSubtitle(catalog.config),
      13,
      DG.textMuted,
    ).setOrigin(0, 0.5);
    this.pointsPill = this.text(
      W - L.pad - 16 - 40 - 12 - 48,
      headerMid,
      "",
      17,
      DG.goldBrightText,
      true,
    ).setOrigin(0.5);
    this.closeBtn = createTouchButton(
      scene,
      W - L.pad - 16 - 20,
      headerMid,
      "✕",
      () => this.destroy(),
      {
        width: 40,
        height: 40,
        depth: 501,
        fontSize: "20px",
        fillColor: DG.neutral,
        strokeColor: DG.steel,
        tapPadding: 6,
        activateOn: "pointerup",
      },
    );
    root.add(this.closeBtn.container);

    // Points bar: summary + legend.
    const pbMid = L.pointsY + L.pointsH / 2;
    this.summary = this.text(
      L.pad + 12,
      pbMid,
      "",
      12,
      DG.textSecondary,
    ).setOrigin(0, 0.5);
    const legend: Array<[string, number, number]> = [
      ["Learned", DG.gold, DG.raised],
      ["Available", DG.goldBright, DG.raised],
      ["Locked", DG.iron, DG.slot],
    ];
    let lx = W - L.pad - 12;
    for (const [label, stroke, fill] of [...legend].reverse()) {
      const t = this.text(lx, pbMid, label, 11, DG.textSecondary);
      t.setOrigin(1, 0.5);
      lx -= label.length * 6 + 6;
      this.chrome.fillStyle(fill, 1).fillCircle(lx - 5, pbMid, 5);
      this.chrome.lineStyle(2, stroke, 1).strokeCircle(lx - 5, pbMid, 5);
      lx -= 24;
    }

    // Branch headers.
    const headY = L.treeY + L.treePad;
    catalog.branches.forEach((b, i) => {
      const cx = this.layout.branchCenters[i]!;
      this.branches.push({
        name: this.text(cx, headY + 17, b.name, 16, DG.text, true).setOrigin(
          0.5,
        ),
        spent: this.text(cx, headY + 37, "", 10, DG.goldText).setOrigin(0.5),
      });
    });

    // Tier labels.
    this.layout.tierRowTops.forEach((top, t) => {
      const gx = L.pad + L.treePad + L.gutterW / 2;
      this.text(gx, top + 26, tierNumeral(t), 16, DG.goldText, true)
        .setOrigin(0.5)
        .setFontStyle("bold");
      this.text(
        gx,
        top + 44,
        `${tierThreshold(catalog, t)} pts`,
        9,
        DG.textMuted,
      ).setOrigin(0.5);
    });

    // Nodes.
    for (const slot of this.layout.nodes) {
      const loc = findTalent(catalog, slot.id)!;
      const hit = scene.add
        .rectangle(slot.x, slot.y + 20, 72, 100, 0x000000, 0)
        .setInteractive();
      hit.on("pointerup", () => this.select(slot.id));
      root.add(hit);
      this.nodes.push({
        loc,
        x: slot.x,
        y: slot.y,
        icon: null,
        hit,
        rank: this.text(slot.x, slot.y + L.orbR, "", 12, DG.text, true)
          .setOrigin(0.5)
          .setFontStyle("bold"),
        name: this.text(
          slot.x,
          slot.y + L.orbR + 14,
          loc.node.name,
          11,
          DG.text,
          false,
          { align: "center", wordWrap: { width: 74 } },
        ).setOrigin(0.5, 0),
        note: this.text(
          slot.x,
          slot.y + L.orbR + 42,
          "",
          9,
          DG.textMuted,
        ).setOrigin(0.5, 0),
      });
    }

    // Detail panel.
    const dx = L.pad + 16;
    const dy = this.layout.detailY + 14;
    this.detailName = this.text(dx, dy, "", 22, DG.text, true)
      .setOrigin(0, 0)
      .setFontStyle("bold");
    this.detailRank = this.text(
      W - L.pad - 26,
      dy + 13,
      "",
      13,
      DG.goldBrightText,
      true,
    ).setOrigin(1, 0.5);
    this.detailDesc = this.text(dx, dy + 34, "", 13, DG.textSecondary, false, {
      wordWrap: { width: W - 2 * L.pad - 32 },
    });
    for (let i = 0; i < 2; i++) {
      const y = dy + 78 + i * 20;
      this.diffs.push({
        label: this.text(dx, y, "", 13, DG.textSecondary),
        from: this.text(W - L.pad - 150, y, "", 13, DG.textMuted).setOrigin(
          1,
          0,
        ),
        to: this.text(W - L.pad - 80, y, "", 13, DG.positive).setOrigin(1, 0),
        delta: this.text(W - L.pad - 16, y, "", 12, DG.positive).setOrigin(
          1,
          0,
        ),
      });
    }
    this.procText = this.text(dx, dy + 78, "", 12, DG.textSecondary);
    this.tierLeft = this.text(dx, dy + 122, "", 11, DG.textMuted);
    this.tierRight = this.text(
      W - L.pad - 16,
      dy + 122,
      "",
      11,
      DG.arcaneText,
    ).setOrigin(1, 0);
    this.statusText = this.text(
      W / 2,
      this.layout.actionY - L.actionH / 2 - 14,
      "",
      12,
      DG.goldBrightText,
      false,
      { align: "center" },
    ).setOrigin(0.5);

    // Action bar.
    const bw = (W - 2 * L.pad - 12) / 2;
    this.learnBtn = createTouchButton(
      scene,
      L.pad + bw / 2,
      this.layout.actionY,
      "",
      () => this.learn(),
      {
        width: bw,
        height: L.actionH,
        depth: 501,
        fontSize: "18px",
        fillColor: DG.buy,
        strokeColor: DG.goldBright,
        tapPadding: 4,
        activateOn: "pointerup",
      },
    );
    this.resetBtn = createTouchButton(
      scene,
      W - L.pad - bw / 2,
      this.layout.actionY,
      "",
      () => this.reset(),
      {
        width: bw,
        height: L.actionH,
        depth: 501,
        fontSize: "18px",
        fillColor: DG.neutral,
        strokeColor: DG.steel,
        tapPadding: 4,
        activateOn: "pointerup",
      },
    );
    root.add([this.learnBtn.container, this.resetBtn.container]);

    this.selectedId = this.defaultSelection();
    ensureTalentIcons(scene);
    scene.textures.on("addtexture", this.onTextureAdded);
    this.loadPixelFont();
    this.refresh();
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    pixel = false,
    extra: Phaser.Types.GameObjects.Text.TextStyle = {},
  ): Phaser.GameObjects.Text {
    const t = this.scene.add.text(
      x,
      y,
      value,
      uiTextStyle(this.scene, {
        fontSize: `${size}px`,
        color,
        ...(pixel ? { fontFamily: PIXEL_FONT } : {}),
        ...extra,
      }),
    );
    if (pixel) this.pixelTexts.push(t);
    this.root.add(t);
    return t;
  }

  /** Re-render Pixelify titles once the web font is ready (index.html @font-face). */
  private loadPixelFont(): void {
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (!fonts?.load) return;
    void fonts
      .load(`700 16px "${DAMAGE_NUMBER_FONT_FAMILY}"`)
      .then(() => {
        if (this.tornDown) return;
        for (const t of this.pixelTexts) t.setFontFamily(PIXEL_FONT);
      })
      .catch(() => undefined);
  }

  private drawChrome(): void {
    const g = this.chrome;
    const W = GAME.width;
    const panel = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
      fill: number,
      stroke: number,
      sw = 1.5,
    ) => {
      g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, r);
      g.lineStyle(sw, stroke, 1).strokeRoundedRect(x, y, w, h, r);
    };
    const inner = W - 2 * L.pad;
    panel(L.pad, L.headerY, inner, L.headerH, 14, DG.panel, DG.gold);
    if (!this.scene.textures.exists(UI_TEXTURE.atkCircle)) {
      const cy = L.headerY + L.headerH / 2;
      g.fillStyle(DG.crimson, 1).fillCircle(L.pad + 42, cy, 26);
      g.lineStyle(2, DG.gold, 1).strokeCircle(L.pad + 42, cy, 26);
    }
    // Points pill (header).
    const pillCx = W - L.pad - 16 - 40 - 12 - 48;
    const pillCy = L.headerY + L.headerH / 2;
    panel(pillCx - 46, pillCy - 17, 92, 34, 16, DG.slot, DG.gold, 1);
    panel(L.pad, L.pointsY, inner, L.pointsH, 10, DG.slot, DG.iron, 1);
    panel(
      L.pad,
      L.treeY,
      inner,
      this.layout.treeBottom - L.treeY,
      14,
      0x1b1511,
      DG.gold,
    );
    panel(
      L.pad,
      this.layout.detailY,
      inner,
      L.detailH,
      14,
      DG.panel,
      DG.arcane,
    );
  }

  private defaultSelection(): string {
    const talents = this.talents();
    const open = this.nodes.find(
      (n) => nodeState(this.catalog, talents, n.loc) === "available",
    );
    return (open ?? this.nodes[0]!).loc.node.id;
  }

  private talents(): SaveTalents {
    return this.getSave().talents;
  }

  private select(id: string): void {
    this.selectedId = id;
    this.resetArmed = false;
    this.statusText.setText("");
    this.refresh();
  }

  private learn(): void {
    const save = this.getSave();
    const id = this.selectedId;
    const reg = this.scene.registry;
    if (!canLearn(this.catalog, save.talents, id, reg)) {
      const loc = findTalent(this.catalog, id)!;
      this.statusText.setText(
        pointsAvailable(save.talents, reg) < 1
          ? "No talent points — win a night to earn more"
          : (lockReason(this.catalog, save.talents, loc) ?? ""),
      );
      return;
    }
    this.resetArmed = false;
    this.onSaveChange({
      ...save,
      talents: learnTalent(this.catalog, save.talents, id, reg),
    });
    const loc = findTalent(this.catalog, id)!;
    this.statusText.setText(`Learned ${loc.node.name}`);
    this.refresh();
  }

  private reset(): void {
    const save = this.getSave();
    const cost = this.catalog.config.resetCostGold;
    const reg = this.scene.registry;
    if (!canResetTalents(this.catalog, save.talents, save.gold, reg)) {
      this.resetArmed = false;
      this.statusText.setText(
        pointsSpent(save.talents) === 0
          ? "Nothing to reset"
          : `Reset costs ${cost}g`,
      );
      this.refresh();
      return;
    }
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.statusText.setText(`Tap again to refund every point for ${cost}g`);
      this.refresh();
      return;
    }
    const r = resetTalents(this.catalog, save.talents, save.gold, reg)!;
    this.resetArmed = false;
    this.onSaveChange({ ...save, talents: r.talents, gold: r.gold });
    this.statusText.setText("Talents reset — points refunded");
    this.refresh();
  }

  private refreshIcons(): void {
    if (this.tornDown) return;
    const talents = this.talents();
    for (const n of this.nodes) {
      const key = talentIconKey(n.loc.node.icon);
      if (!n.icon && this.scene.textures.exists(key)) {
        n.icon = this.scene.add.image(n.x, n.y - 2, key).setDisplaySize(30, 30);
        this.root.addAt(n.icon, this.root.getIndex(this.tree) + 1);
      }
      n.icon?.setAlpha(
        nodeState(this.catalog, talents, n.loc) === "locked" ? 0.35 : 1,
      );
    }
  }

  private refresh(): void {
    const save = this.getSave();
    const talents = save.talents;
    const cat = this.catalog;
    const free = pointsAvailable(talents, this.scene.registry);
    this.pointsPill.setText(`✦ ${free} pts`);
    this.summary.setText(
      `${pointsSpent(talents)} spent · ${talents.earned} earned · ${save.gold}g`,
    );

    // Branch headers + tree graphics.
    const g = this.tree;
    g.clear();
    const headY = L.treeY + L.treePad;
    cat.branches.forEach((b, i) => {
      const spent = branchPointsSpent(talents, b);
      const cx = this.layout.branchCenters[i]!;
      g.fillStyle(spent ? DG.raised : DG.slot, 1);
      g.fillRoundedRect(cx - L.cellW / 2, headY, L.cellW, L.branchHeadH, 10);
      g.lineStyle(1, spent ? DG.gold : DG.iron, 1);
      g.strokeRoundedRect(cx - L.cellW / 2, headY, L.cellW, L.branchHeadH, 10);
      const view = this.branches[i]!;
      view.name.setColor(spent ? DG.text : DG.textSecondary);
      view.spent
        .setText(`${spent} pts spent`)
        .setColor(spent ? DG.goldText : DG.textMuted);
    });
    // Iron first, gold on top, so shared segments read as learned.
    const learned = (id: string) => talentRank(talents, id) > 0;
    for (const pass of ["iron", "gold"] as const) {
      for (const c of this.layout.connectors) {
        const lit = learned(c.parentId) && learned(c.childId);
        if ((pass === "gold") !== lit) continue;
        g.lineStyle(3, lit ? DG.gold : DG.iron, 1);
        g.beginPath();
        g.moveTo(c.points[0]!.x, c.points[0]!.y);
        for (const p of c.points.slice(1)) g.lineTo(p.x, p.y);
        g.strokePath();
      }
    }
    for (const n of this.nodes) {
      const state = nodeState(cat, talents, n.loc);
      const ring = STATE_RING[state];
      const selected = n.loc.node.id === this.selectedId;
      if (selected) {
        g.lineStyle(5, DG.arcane, 1).strokeCircle(n.x, n.y, L.orbR + 6);
      }
      if (state === "available") {
        g.fillStyle(DG.goldBright, 0.18).fillCircle(n.x, n.y, L.orbR + 6);
      }
      g.fillStyle(ring.fill, 1).fillCircle(n.x, n.y, L.orbR);
      g.lineStyle(state === "locked" ? 2 : 3, ring.stroke, 1);
      g.strokeCircle(n.x, n.y, L.orbR);
      // Rank pill overlapping the orb's bottom edge.
      const pillW = 34;
      g.fillStyle(state === "locked" ? DG.slot : DG.abyss, 1);
      g.fillRoundedRect(n.x - pillW / 2, n.y + L.orbR - 9, pillW, 18, 8);
      g.lineStyle(1, state === "locked" ? DG.iron : DG.gold, 1);
      g.strokeRoundedRect(n.x - pillW / 2, n.y + L.orbR - 9, pillW, 18, 8);
      const rank = talentRank(talents, n.loc.node.id);
      n.rank
        .setText(`${rank}/${n.loc.node.maxRank}`)
        .setColor(
          state === "locked"
            ? DG.textMuted
            : state === "maxed"
              ? DG.goldBrightText
              : DG.text,
        );
      n.name.setColor(
        state === "locked"
          ? DG.textMuted
          : state === "available"
            ? DG.goldBrightText
            : DG.text,
      );
      n.note.setText(
        choiceTakenElsewhere(talents, n.loc) && rank === 0
          ? "choice taken"
          : "",
      );
    }
    this.refreshIcons();
    this.refreshDetail(save);
  }

  private refreshDetail(save: SaveGame): void {
    const talents = save.talents;
    const loc = findTalent(this.catalog, this.selectedId)!;
    const rank = talentRank(talents, loc.node.id);
    this.detailName.setText(loc.node.name);
    this.detailRank.setText(rankLabel(talents, loc));
    this.detailDesc.setText(talentDescription(loc));
    const rows = talentDiffRows(loc, rank);
    this.diffs.forEach((v, i) => {
      const r = rows[i];
      v.label.setText(r?.label ?? "");
      v.from.setText(r ? r.from : "");
      v.to.setText(r?.to ? `→  ${r.to}` : "");
      v.delta.setText(r?.delta ?? "");
    });
    const procs = talentProcLines(loc, rank);
    this.procText
      .setY(this.detailDesc.y + 44 + Math.min(rows.length, 2) * 20)
      .setText(procs.join("\n"));
    const progress = nextTierProgress(this.catalog, talents, loc);
    this.tierLeft.setText(progress.label);
    this.tierRight.setText(`${progress.have} / ${progress.need}`);
    const barX = L.pad + 16;
    const barW = GAME.width - 2 * L.pad - 32;
    const barY = this.tierLeft.y + 20;
    const g = this.tree;
    g.fillStyle(DG.slot, 1).fillRoundedRect(barX, barY, barW, 6, 3);
    const frac = Math.min(1, progress.have / Math.max(1, progress.need));
    if (frac > 0) {
      g.fillStyle(DG.arcane, 1);
      g.fillRoundedRect(barX, barY, Math.max(6, barW * frac), 6, 3);
    }

    const learnable = canLearn(
      this.catalog,
      talents,
      loc.node.id,
      this.scene.registry,
    );
    this.learnBtn.setLabel(
      rank >= loc.node.maxRank ? "Maxed" : "↑ Learn · 1 pt",
    );
    this.learnBtn.container.setAlpha(learnable ? 1 : DISABLED_ALPHA);
    const cost = this.catalog.config.resetCostGold;
    this.resetBtn.setLabel(
      this.resetArmed ? `Confirm · ${cost}g` : `⟳ Reset · ${cost}g`,
    );
    this.resetBtn.container.setAlpha(
      canResetTalents(this.catalog, talents, save.gold, this.scene.registry)
        ? 1
        : DISABLED_ALPHA,
    );
  }

  destroy(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.scene.textures.off("addtexture", this.onTextureAdded);
    this.modalLease.release();
    if (this.root.active) this.root.destroy();
    this.onDismiss?.();
  }

  /** Talent id of the detail panel selection (e2e / tests). */
  selectedTalentId(): string {
    return this.selectedId;
  }

  e2eTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    const add = (id: string, btn: Button): void => {
      if (btn.container.alpha < 0.5) return;
      const r = interactiveObjectScreenRect(btn.container);
      if (!r) return;
      out[id] = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    add("talents-learn", this.learnBtn);
    add("talents-reset", this.resetBtn);
    add("talents-close", this.closeBtn);
    for (const n of this.nodes) {
      out[`talents-node-${n.loc.node.id}`] = { x: n.hit.x, y: n.hit.y };
    }
    return out;
  }
}
