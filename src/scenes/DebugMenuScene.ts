import Phaser from "phaser";
import {
  setShowCombatRanges,
  setShowEnemyPaths,
  setShowFpsCounter,
  setShowHitboxes,
  setShowTouchInput,
  showCombatRanges,
  showEnemyPaths,
  showFpsCounter,
  showHitboxes,
  showTouchInput,
} from "../debug/DebugState";
import { configureSceneInput } from "../input/inputTuning";
import { collectInteractiveScreenRects } from "../debug/collectInteractiveScreenRects";
import { TouchInputDebugDraw } from "../debug/TouchInputDebugDraw";
import { readSafeInsets } from "../ui/screenLayout";
import { uiTextStyle } from "../ui/uiTextStyle";
import {
  getWorldPixelScale,
  setDebugWorldPixelScale,
} from "../core/worldPixelScale";
import { fullscreenAvailable, toggleFullscreen } from "../ui/fullscreen";
import {
  DEBUG_MENU_CLOSE,
  isDefenseDebugHost,
} from "../debug/debugMenuLifecycle";
import { type DebugMenuItem, layoutDebugMenu } from "../debug/debugMenuLayout";
import { DEBUG_TOOLTIPS } from "../debug/debugMenuTooltips";
import type { WorldTextureFilterMode } from "../core/pixelArtTextures";
import { uiPartKey } from "../content/uiParts";
import { addUiFrame, hasUiPart } from "../ui/uiFrame";
import { transitionDefenseToTown } from "./defense/DefenseNightEnd";
import {
  applyPixelRenderDebugSettings,
  getDebugCameraRoundPixels,
  getDebugRendererRoundPixels,
  getDebugScaleAutoRound,
  getDebugWorldTextureFilter,
  setDebugCameraRoundPixels,
  setDebugRendererRoundPixels,
  setDebugScaleAutoRound,
  setDebugWorldTextureFilter,
} from "../core/pixelRenderDebug";
import {
  debugInfiniteGold,
  debugInfiniteTalentPoints,
  setDebugInfiniteGold,
  setDebugInfiniteTalentPoints,
} from "../debug/debugEconomy";

const DEPTH = 401;
const C = {
  text: "#F4EDE1",
  gold: "#F2C75C",
  goldInt: 0xf2c75c,
  on: "#8BE39A",
  off: "#9A8F82",
  muted: "#B5AA9A",
  rule: 0x3d342c,
  segOn: 0x4a3a18,
};
const W_TOGGLE = 78;
const H_TOGGLE = 45;
const INFO_R = 15;

/** Plain, big-text debug sheet (DefenseUIbot mockup `debug-menu.html`). */
export class DebugMenuScene extends Phaser.Scene {
  private touchDebug!: TouchInputDebugDraw;
  private tooltip: Phaser.GameObjects.GameObject[] = [];
  private tooltipFor: string | null = null;
  /** Set for the tap that opened a tooltip, so the backdrop's pointerup keeps it. */
  private keepTooltip = false;

  constructor() {
    super({ key: "DebugMenu" });
  }

  create(): void {
    configureSceneInput(this);
    this.tooltip = [];
    this.tooltipFor = null;
    const safe = readSafeInsets();
    const w = this.scale.width;
    const h = this.scale.height;
    const fromDefense = isDefenseDebugHost(this);
    const reg = this.game.registry;
    const items: DebugMenuItem[] = [
      { kind: "section", label: "OVERLAYS" },
      { kind: "row", id: "hitboxes" },
      { kind: "row", id: "ranges" },
      { kind: "row", id: "touch" },
      { kind: "row", id: "paths" },
      { kind: "row", id: "fps" },
      { kind: "section", label: "GRAPHICS" },
      { kind: "row", id: "filter" },
      { kind: "row", id: "cam" },
      { kind: "row", id: "renderer" },
      { kind: "row", id: "autoround" },
      { kind: "row", id: "world" },
      { kind: "row", id: "fullscreen" },
      { kind: "section", label: "CHEATS" },
      { kind: "row", id: "gold" },
      { kind: "row", id: "talents" },
    ];
    const L = layoutDebugMenu(w, h, safe, items);

    this.add
      .rectangle(0, 0, w, h, 0x000000, 0.65)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(400)
      .setInteractive()
      .on("pointerup", () => {
        if (!this.keepTooltip) this.hideTooltip();
      });

    const sheetBg = this.add
      .rectangle(L.sheet.x, L.sheet.y, L.sheet.w, L.sheet.h, 0x161a19, 1)
      .setOrigin(0)
      .setDepth(DEPTH)
      .setScrollFactor(0);
    sheetBg.setStrokeStyle(2, 0x3d342c);
    const frame = addUiFrame(
      this,
      "dark",
      L.sheet.x,
      L.sheet.y,
      L.sheet.w,
      L.sheet.h,
    );
    frame?.setDepth(DEPTH).setScrollFactor(0);

    const rules = this.add.graphics().setDepth(DEPTH).setScrollFactor(0);
    this.label(30, L.titleY, "Debug", 30, C.gold).setOrigin(0, 0.5);
    rules.fillStyle(C.rule, 1).fillRect(24, L.titleY + 28, w - 48, 1);

    items.forEach((it, i) => {
      if (it.kind !== "section") return;
      this.label(30, L.y[`section:${i}`]!, it.label, 14, C.gold)
        .setOrigin(0, 0.5)
        .setLetterSpacing(2);
    });
    const rowY = (id: string) => L.y[id]!;
    // Hairlines between rows.
    for (const it of items) {
      if (it.kind !== "row") continue;
      rules
        .fillStyle(C.rule, 0.6)
        .fillRect(24, rowY(it.id) + L.rowH / 2, w - 48, 1);
    }

    const right = w - 30;
    const toggle = (
      id: string,
      label: string,
      get: () => boolean,
      set: (on: boolean) => void,
    ) => {
      const y = rowY(id);
      const info = !!DEBUG_TOOLTIPS[id];
      const tx = (info ? right - 2 * INFO_R - 14 : right) - W_TOGGLE / 2;
      this.label(30, y, label, 20, C.text).setOrigin(0, 0.5);
      const state = this.label(
        tx - W_TOGGLE / 2 - 10,
        y,
        "",
        15,
        C.off,
      ).setOrigin(1, 0.5);
      const sw = this.switchArt(tx, y);
      const paint = () => {
        const on = get();
        state.setText(on ? "ON" : "OFF").setColor(on ? C.on : C.off);
        sw(on);
      };
      paint();
      this.zone(
        20,
        y - L.rowH / 2,
        (info ? right - 2 * INFO_R - 8 : right + 10) - 20,
        L.rowH,
        () => {
          set(!get());
          paint();
        },
      );
      if (info) this.infoButton(id, right - INFO_R, y, L.rowH);
    };

    const segmented = (
      id: string,
      label: string,
      options: Array<{ label: string; value: string }>,
      get: () => string,
      set: (v: string) => void,
      segW: number,
    ) => {
      const y = rowY(id);
      this.label(30, y, label, 20, C.text).setOrigin(0, 0.5);
      const totalW = segW * options.length + 12;
      const x1 = right - 2 * INFO_R - 14;
      const x0 = x1 - totalW;
      const box = addUiFrame(this, "btn", x0, y - 17, totalW, 34);
      box?.setDepth(DEPTH).setScrollFactor(0);
      const hi = this.add.graphics().setDepth(DEPTH).setScrollFactor(0);
      const texts = options.map((o, i) =>
        this.label(
          x0 + 6 + segW * i + segW / 2,
          y,
          o.label,
          15,
          C.muted,
        ).setOrigin(0.5),
      );
      const paint = () => {
        hi.clear();
        const cur = get();
        options.forEach((o, i) => {
          const sx = x0 + 6 + segW * i;
          if (i > 0) hi.fillStyle(0x4a4238, 1).fillRect(sx, y - 11, 1, 22);
          const on = o.value === cur;
          texts[i]!.setColor(on ? C.gold : C.muted);
          if (on) {
            hi.fillStyle(C.segOn, 1).fillRect(sx + 2, y - 12, segW - 4, 24);
            hi.lineStyle(2, C.goldInt, 1).strokeRect(
              sx + 3,
              y - 11,
              segW - 6,
              22,
            );
          }
        });
      };
      paint();
      options.forEach((o, i) => {
        this.zone(x0 + 6 + segW * i, y - L.rowH / 2, segW, L.rowH, () => {
          set(o.value);
          paint();
        });
      });
      this.infoButton(id, right - INFO_R, y, L.rowH);
    };

    toggle(
      "hitboxes",
      "Hitboxes",
      () => showHitboxes(this.registry),
      (on) => setShowHitboxes(this.registry, on),
    );
    toggle(
      "ranges",
      "Combat ranges",
      () => showCombatRanges(this.registry),
      (on) => setShowCombatRanges(this.registry, on),
    );
    toggle(
      "touch",
      "Touch input",
      () => showTouchInput(this.registry),
      (on) => setShowTouchInput(this.registry, on),
    );
    toggle(
      "paths",
      "Enemy paths",
      () => showEnemyPaths(this.registry),
      (on) => setShowEnemyPaths(this.registry, on),
    );
    toggle(
      "fps",
      "FPS / frame time",
      () => showFpsCounter(this.registry),
      (on) => setShowFpsCounter(this.registry, on),
    );
    segmented(
      "filter",
      "Texture filter",
      [
        { label: "Nearest", value: "nearest" },
        { label: "Linear", value: "linear" },
        { label: "Hybrid", value: "hybrid" },
      ],
      () => getDebugWorldTextureFilter(reg),
      (v) => setDebugWorldTextureFilter(this.game, v as WorldTextureFilterMode),
      76,
    );
    const pixelToggle = (
      get: (r: typeof reg) => boolean,
      set: (r: typeof reg, on: boolean) => void,
    ) =>
      [
        () => get(reg),
        (on: boolean) => {
          set(reg, on);
          applyPixelRenderDebugSettings(this.game);
        },
      ] as const;
    toggle(
      "cam",
      "Camera round px",
      ...pixelToggle(getDebugCameraRoundPixels, setDebugCameraRoundPixels),
    );
    toggle(
      "renderer",
      "Renderer round px",
      ...pixelToggle(getDebugRendererRoundPixels, setDebugRendererRoundPixels),
    );
    toggle(
      "autoround",
      "Scale auto-round",
      ...pixelToggle(getDebugScaleAutoRound, setDebugScaleAutoRound),
    );
    segmented(
      "world",
      "World scale",
      [1, 2, 3].map((n) => ({ label: `${n}×`, value: String(n) })),
      () => String(getWorldPixelScale(this.registry)),
      (v) => setDebugWorldPixelScale(this.game, Number(v)),
      40,
    );
    this.fullscreenRow(rowY("fullscreen"), right, L.rowH);
    toggle(
      "gold",
      "Infinite gold",
      () => debugInfiniteGold(reg),
      (on) => setDebugInfiniteGold(reg, on),
    );
    toggle(
      "talents",
      "Infinite talent points",
      () => debugInfiniteTalentPoints(reg),
      (on) => setDebugInfiniteTalentPoints(reg, on),
    );

    // Footer.
    const fy = L.footerY;
    rules.fillStyle(C.rule, 1).fillRect(24, fy - 40, w - 48, 1);
    const bw = (w - 60 - 12) / 2;
    if (fromDefense) {
      this.footerButton(30, fy, bw, "Go to town", "btnRed", () =>
        this.leaveDefenseForTown(),
      );
      this.footerButton(30 + bw + 12, fy, bw, "Close", "btnDark", () =>
        this.closeMenu(),
      );
    } else {
      this.footerButton(w / 2 - bw / 2, fy, bw, "Close", "btnDark", () =>
        this.closeMenu(),
      );
    }

    this.touchDebug = new TouchInputDebugDraw(this);
    this.events.on("shutdown", () => this.touchDebug.destroy());
  }

  private label(
    x: number,
    y: number,
    str: string,
    size: number,
    color: string,
  ): Phaser.GameObjects.Text {
    return this.add
      .text(
        x,
        y,
        str,
        uiTextStyle(this, { fontSize: `${size}px`, color, fontStyle: "bold" }),
      )
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
  }

  private zone(
    x: number,
    y: number,
    w: number,
    h: number,
    onTap: () => void,
  ): void {
    this.add
      .rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.001)
      .setScrollFactor(0)
      .setDepth(DEPTH + 2)
      .setInteractive()
      .on("pointerup", () => {
        this.hideTooltip();
        onTap();
      });
  }

  /** Gothic Pixel UI toggle (AbyssOwl); vector pill fallback. Returns a painter. */
  private switchArt(cx: number, cy: number): (on: boolean) => void {
    if (hasUiPart(this, "gp-toggle-on")) {
      const img = this.add
        .image(cx, cy, uiPartKey("gp-toggle-off"))
        .setDisplaySize(W_TOGGLE, H_TOGGLE)
        .setScrollFactor(0)
        .setDepth(DEPTH + 1);
      return (on) =>
        img
          .setTexture(uiPartKey(on ? "gp-toggle-on" : "gp-toggle-off"))
          .setDisplaySize(W_TOGGLE, H_TOGGLE);
    }
    const g = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
    return (on) => {
      g.clear();
      g.fillStyle(on ? 0x6b5a1e : 0x2a2b26, 1).fillRoundedRect(
        cx - 34,
        cy - 16,
        68,
        32,
        16,
      );
      g.fillStyle(on ? C.goldInt : 0x6b625a, 1).fillCircle(
        on ? cx + 18 : cx - 18,
        cy,
        12,
      );
    };
  }

  private infoButton(id: string, cx: number, cy: number, rowH: number): void {
    const g = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
    const t = this.label(cx, cy + 1, "i", 18, C.text).setOrigin(0.5);
    const paint = () => {
      const open = this.tooltipFor === id;
      g.clear();
      g.fillStyle(open ? C.goldInt : 0x1a1613, 1).fillCircle(cx, cy, INFO_R);
      g.lineStyle(2, open ? 0xfbbf24 : 0x9a8f82, 1).strokeCircle(
        cx,
        cy,
        INFO_R,
      );
      t.setColor(open ? "#1a1613" : C.text);
    };
    paint();
    this.add
      .rectangle(cx, cy, rowH, rowH, 0x000000, 0.001)
      .setScrollFactor(0)
      .setDepth(DEPTH + 2)
      .setInteractive()
      .on("pointerup", () => {
        const wasOpen = this.tooltipFor === id;
        this.hideTooltip();
        if (!wasOpen) {
          this.showTooltip(id, cy + rowH / 2 + 4);
          this.keepTooltip = true;
          this.time.delayedCall(0, () => {
            this.keepTooltip = false;
          });
        }
        paint();
        this.events.once("debug-tooltip-hidden", paint);
      });
  }

  private showTooltip(id: string, top: number): void {
    const tip = DEBUG_TOOLTIPS[id];
    if (!tip) return;
    this.tooltipFor = id;
    const x = 24;
    const w = this.scale.width - 48;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const lines: Phaser.GameObjects.Text[] = [];
    let y = top + 20;
    const add = (str: string, color: string, size = 15) => {
      const t = this.label(x + 22, y, str, size, color)
        .setDepth(DEPTH + 4)
        .setWordWrapWidth(w - 44, true);
      lines.push(t);
      y += (t.height || size + 4) + 8;
      return t;
    };
    add(tip.intro, C.text);
    for (const o of tip.options ?? []) {
      const name = this.label(x + 22, y, o.name, 15, C.gold).setDepth(
        DEPTH + 4,
      );
      const rest = this.label(
        x + 22 + (name.width || 0),
        y,
        ` - ${o.text}`,
        15,
        C.text,
      ).setDepth(DEPTH + 4);
      lines.push(name, rest);
      y += (rest.height || 19) + 8;
    }
    add(tip.footnote, C.muted, 13);
    const h = y - top + 12;
    const bg = this.add
      .rectangle(x, top, w, h, 0x26241f, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH + 3);
    parts.push(bg, ...lines);
    const frame = addUiFrame(this, "ornate", x, top, w, h);
    if (frame) parts.push(frame.setScrollFactor(0).setDepth(DEPTH + 3.5));
    // Tap inside the tooltip closes it.
    parts.push(
      this.add
        .rectangle(x + w / 2, top + h / 2, w, h, 0x000000, 0.001)
        .setScrollFactor(0)
        .setDepth(DEPTH + 6)
        .setInteractive()
        .on("pointerup", () => this.hideTooltip()),
    );
    this.tooltip = parts;
  }

  private hideTooltip(): void {
    if (!this.tooltipFor) return;
    for (const p of this.tooltip) p.destroy();
    this.tooltip = [];
    this.tooltipFor = null;
    this.events.emit("debug-tooltip-hidden");
  }

  private fullscreenRow(y: number, right: number, rowH: number): void {
    this.label(30, y, "Fullscreen", 20, C.text).setOrigin(0, 0.5);
    const bw = 76;
    const x0 = right - 2 * INFO_R - 14 - bw;
    const frame = addUiFrame(this, "btn", x0, y - 17, bw, 34);
    frame?.setDepth(DEPTH).setScrollFactor(0);
    const t = this.label(x0 + bw / 2, y, "", 15, C.text).setOrigin(0.5);
    const paint = () => {
      if (!fullscreenAvailable(this.scale)) t.setText("N/A");
      else t.setText(this.scale.isFullscreen ? "Exit" : "Enter");
    };
    paint();
    this.add
      .rectangle(x0 + bw / 2, y, bw + 10, rowH, 0x000000, 0.001)
      .setScrollFactor(0)
      .setDepth(DEPTH + 2)
      .setInteractive()
      .on("pointerup", () => {
        toggleFullscreen(this.scale);
        paint();
      });
    this.infoButton("fullscreen", right - INFO_R, y, rowH);
  }

  private footerButton(
    x: number,
    cy: number,
    w: number,
    label: string,
    frame: "btnRed" | "btnDark",
    onTap: () => void,
  ): void {
    const h = 52;
    const art = addUiFrame(this, frame, x, cy - h / 2 + 5, w, h - 5);
    if (art) art.setScrollFactor(0).setDepth(DEPTH);
    else
      this.add
        .rectangle(
          x,
          cy - h / 2,
          w,
          h,
          frame === "btnRed" ? 0x5a1d1d : 0x2a241e,
          1,
        )
        .setOrigin(0)
        .setStrokeStyle(2, C.goldInt)
        .setScrollFactor(0)
        .setDepth(DEPTH);
    this.label(x + w / 2, cy + 3, label, 20, C.text).setOrigin(0.5);
    this.add
      .rectangle(x + w / 2, cy, w, h + 8, 0x000000, 0.001)
      .setScrollFactor(0)
      .setDepth(DEPTH + 2)
      .setInteractive()
      .on("pointerup", onTap);
  }

  override update(_time: number, _delta: number): void {
    if (!showTouchInput(this.registry)) {
      this.touchDebug.clear();
      return;
    }
    this.touchDebug.draw({
      pointerUiBlocked: (pointer) => this.isPointerOverInteractive(pointer),
      uiScreenRects: collectInteractiveScreenRects(this, {
        skip: [this.touchDebug.uiGraphics(), this.touchDebug.worldGraphics()],
      }),
    });
  }

  private isPointerOverInteractive(pointer: Phaser.Input.Pointer): boolean {
    const hits = this.input.hitTestPointer(pointer);
    for (const hit of hits) {
      if (this.hasInteractiveInput(hit as Phaser.GameObjects.GameObject))
        return true;
    }
    return false;
  }

  private hasInteractiveInput(obj: Phaser.GameObjects.GameObject): boolean {
    let node: Phaser.GameObjects.GameObject | null = obj;
    while (node) {
      if (node.input?.enabled) return true;
      const parent: Phaser.GameObjects.Container | null =
        (
          node as Phaser.GameObjects.GameObject & {
            parentContainer?: Phaser.GameObjects.Container;
          }
        ).parentContainer ?? null;
      node = parent;
    }
    return false;
  }

  private closeMenu(): void {
    this.game.events.emit(DEBUG_MENU_CLOSE);
    this.scene.stop("DebugMenu");
  }

  /** Mid-night exit — same deferred Town transition as Return to town (#169). */
  private leaveDefenseForTown(): void {
    if (!isDefenseDebugHost(this)) return;
    const defense = this.scene.get("Defense");
    if (!defense) return;
    transitionDefenseToTown(defense);
  }
}
