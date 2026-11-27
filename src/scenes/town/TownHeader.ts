import type Phaser from "phaser";
import { PALETTE, PALETTE_CSS } from "../../ui/theme/uiPalette";
import { isNativeApp } from "../../appUpdate/isNativeApp";
import {
  formatUpdateStatus,
  type UpdateStatus,
} from "../../appUpdate/checkForUpdate";
import { getEmbeddedBuildId, townBuildIdLine } from "../../buildId";
import { GAME } from "../../config";
import type { DataStore } from "../../core/data/DataStore";
import type { SaveGame } from "../../core/save/saveTypes";
import { scaleUiX } from "../../config/uiScale";
import {
  toggleFullscreen,
  fullscreenButtonLabel,
} from "../../ui/layout/fullscreen";
import {
  debugButtonPosition,
  townGearButtonPosition,
  readSafeInsets,
  townFullscreenButtonPosition,
  townResetSaveButtonPosition,
  townUpdateButtonPosition,
  townStatusTextTopY,
  townTalentsButtonPosition,
  townTitleY,
} from "../../ui/layout/screenLayout";
import { createTouchButton } from "../../ui/touch/touchButton";
import { uiTextStyle } from "../../ui/layout/uiTextStyle";
import { addUiFrame } from "../../ui/layout/uiFrame";
import { rerenderTextsWhenFontReady } from "../../ui/layout/uiTextStyle";
import { TOWN_STAGE_NAMES } from "../../config/townGrowth";
import { TOWN_ISO_TEXTURE } from "../../content/townIsoAssets";
import { uiPartKey } from "../../content/uiParts";
import type { TownGrowthView } from "../../world/townIso/townGrowth";

type TouchButton = ReturnType<typeof createTouchButton>;

const HUD_DEPTH = 150;
const TOP_BAR_H = 136;
const BOTTOM_BAR_H = 128;
const GOLD_TEXT = "#F2C75C";
const PARCHMENT = "#E8DCC0";

function hudText(
  scene: Phaser.Scene,
  px: number,
  color: string,
): Phaser.Types.GameObjects.Text.TextStyle {
  return uiTextStyle(scene, {
    fontSize: `${px}px`,
    fontStyle: "bold",
    color,
    stroke: "#0b0908",
    strokeThickness: px > 14 ? 4 : 3,
  });
}

/** Gothic bar from a full-width 540 px panel (only the middle rows stretch). */
function addHudBar(
  scene: Phaser.Scene,
  key: string,
  y: number,
  h: number,
  top: number,
  bottom: number,
): void {
  if (!scene.textures?.exists?.(key) || !scene.add?.nineslice) return;
  scene.add
    .nineslice(0, y, key, undefined, GAME.width, h, 16, 16, top, bottom)
    .setOrigin(0)
    .setDepth(HUD_DEPTH);
}

export type TownHud = {
  /** Status lines under the title (also shows transient tap messages). */
  statusText: Phaser.GameObjects.Text;
  /** Gold pill + town level / growth bar. Town level is a placeholder (config/townGrowth.ts). */
  update: (save: SaveGame, growth: TownGrowthView) => void;
};

/** Gothic top bar (title, status, gold) and bottom bar (town level + growth). */
export function createTownHeader(scene: Phaser.Scene): TownHud {
  // Camera clear instead of a full-screen rectangle: the baked town world covers the screen,
  // and every full-screen layer is costly under software-rendered WebGL.
  scene.cameras?.main?.setBackgroundColor(0x0e0d10);
  addHudBar(scene, TOWN_ISO_TEXTURE.topBar, 0, TOP_BAR_H, 16, 32);
  const bottomY = GAME.height - BOTTOM_BAR_H;
  addHudBar(scene, TOWN_ISO_TEXTURE.bottomBar, bottomY, BOTTOM_BAR_H, 34, 16);

  const titleY = townTitleY();
  scene.add
    .image(32, titleY, uiPartKey("ed-moon"))
    .setDisplaySize(24, 24)
    .setDepth(HUD_DEPTH + 1);
  const title = scene.add
    .text(52, titleY, "Town — Day", hudText(scene, 24, GOLD_TEXT))
    .setOrigin(0, 0.5)
    .setDepth(HUD_DEPTH + 1);

  const statusText = scene.add
    .text(
      52,
      townStatusTextTopY(),
      "",
      uiTextStyle(scene, {
        fontSize: "13px",
        color: PARCHMENT,
        stroke: "#0b0908",
        strokeThickness: 3,
        lineSpacing: 1,
        wordWrap: { width: GAME.width - 52 - 140 },
      }),
    )
    .setOrigin(0, 0)
    .setDepth(HUD_DEPTH + 1);

  const goldW = 108;
  const goldH = 30;
  const goldX = GAME.width - 14 - goldW;
  const goldPill = addUiFrame(
    scene,
    "plate",
    goldX,
    titleY - goldH / 2,
    goldW,
    goldH,
  );
  goldPill?.setDepth(HUD_DEPTH + 1);
  scene.add
    .image(goldX + 16, titleY, uiPartKey("da-gem-gold"))
    .setDisplaySize(14, 13)
    .setDepth(HUD_DEPTH + 2);
  const goldText = scene.add
    .text(goldX + goldW - 12, titleY, "0", hudText(scene, 17, "#FBBF24"))
    .setOrigin(1, 0.5)
    .setDepth(HUD_DEPTH + 2);

  const lvY = bottomY + 40;
  const lvText = scene.add
    .text(18, lvY, "", hudText(scene, 18, GOLD_TEXT))
    .setOrigin(0, 0.5)
    .setDepth(HUD_DEPTH + 1);
  const hintText = scene.add
    .text(0, lvY + 1, "", hudText(scene, 13, PARCHMENT))
    .setOrigin(0, 0.5)
    .setDepth(HUD_DEPTH + 1);
  const barX = 16;
  const barY = lvY + 16;
  const barW = GAME.width - 32;
  const barH = 12;
  const track = scene.add
    .rectangle(barX, barY, barW, barH, 0x15120f)
    .setOrigin(0)
    .setStrokeStyle(2, 0x6b5a3a)
    .setDepth(HUD_DEPTH + 1);
  const fill = scene.add
    .image(barX + 2, barY + 2, uiPartKey("da-fill-gold-hi"))
    .setOrigin(0)
    .setDepth(HUD_DEPTH + 2);
  void track;

  const update = (save: SaveGame, growth: TownGrowthView): void => {
    goldText.setText(String(save.gold));
    lvText.setText(`Town Lv ${growth.townLevel}`);
    const stageName = TOWN_STAGE_NAMES[growth.stage];
    hintText.setText(
      growth.nextStageTownLevel === null
        ? `${stageName} · Max stage`
        : `${stageName} · Grows at Town Lv ${growth.nextStageTownLevel}`,
    );
    hintText.setX(lvText.x + lvText.width + 10);
    const w = Math.max(0, (barW - 4) * growth.progress);
    fill.setDisplaySize(Math.max(1, w), barH - 4).setVisible(w > 0);
  };

  rerenderTextsWhenFontReady(
    '700 24px "Pixelify Sans"',
    () => [title, statusText, goldText, lvText, hintText],
    () => hintText.setX(lvText.x + lvText.width + 10),
  );

  return { statusText, update };
}

export type TownHeaderButtons = {
  debugButton: TouchButton;
  gearButton: TouchButton;
  talentsButton: TouchButton;
  fullscreenButton: TouchButton;
  resetButton: TouchButton;
  updateButton?: TouchButton;
};

/** Debug, gear, talents, fullscreen and reset-save buttons (created in that order). */
type TownHeaderButtonStyle = Partial<
  Parameters<typeof createTouchButton>[5]
> & {
  fillColor: number;
  strokeColor: number;
};

/** Header button with the shared size (88×36), depth and font; `style` overrides. */
function townHeaderButton(
  scene: Phaser.Scene,
  pos: { x: number; y: number },
  label: string,
  onTap: () => void,
  style: TownHeaderButtonStyle,
): TouchButton {
  return createTouchButton(scene, pos.x, pos.y, label, onTap, {
    width: scaleUiX(88),
    height: scaleUiX(36),
    depth: 200,
    fontSize: `${scaleUiX(14)}px`,
    ...style,
  });
}

export function createTownHeaderButtons(
  scene: Phaser.Scene,
  handlers: {
    onDebug: () => void;
    onGear: () => void;
    onTalents: () => void;
    onReset: () => void;
  },
): TownHeaderButtons {
  const safe = readSafeInsets();
  const debugButton = townHeaderButton(
    scene,
    debugButtonPosition(scene, safe),
    "Debug",
    () => handlers.onDebug(),
    { fillColor: PALETTE.zinc700, strokeColor: PALETTE.zinc400 },
  );
  const gearButton = townHeaderButton(
    scene,
    townGearButtonPosition(scene, safe),
    "Gear",
    () => handlers.onGear(),
    { fillColor: 0x713f12, strokeColor: PALETTE.amber400 },
  );
  gearButton.container.setData("testid", "town-gear");
  const talentsButton = townHeaderButton(
    scene,
    townTalentsButtonPosition(scene, safe),
    "Talents",
    () => handlers.onTalents(),
    { fillColor: 0x3a322b, strokeColor: 0xd4a64a },
  );
  talentsButton.container.setData("testid", "town-talents");

  const fsWidth = scaleUiX(168);
  const fsHeight = scaleUiX(36);
  const fullscreenButton = townHeaderButton(
    scene,
    townFullscreenButtonPosition(scene, safe, fsWidth, fsHeight),
    fullscreenButtonLabel(scene.scale),
    () => toggleFullscreen(scene.scale),
    {
      width: fsWidth,
      height: fsHeight,
      fontSize: `${scaleUiX(13)}px`,
      fillColor: PALETTE.deepNavy,
      strokeColor: PALETTE.blue400,
      activateOn: "pointerup",
    },
  );

  const resetWidth = scaleUiX(118);
  const resetHeight = scaleUiX(36);
  const resetButton = townHeaderButton(
    scene,
    townResetSaveButtonPosition(scene, safe, resetWidth, resetHeight),
    "Reset save",
    () => handlers.onReset(),
    {
      width: resetWidth,
      height: resetHeight,
      fillColor: PALETTE.red900,
      strokeColor: PALETTE.red400,
    },
  );

  const nativeButtons = isNativeApp()
    ? createTownUpdateButton(scene, safe, fsWidth, fsHeight)
    : {};

  return {
    debugButton,
    gearButton,
    talentsButton,
    fullscreenButton,
    resetButton,
    ...nativeButtons,
  };
}

function createTownUpdateButton(
  scene: Phaser.Scene,
  safe: ReturnType<typeof readSafeInsets>,
  fsWidth: number,
  fsHeight: number,
): { updateButton: TouchButton } {
  const width = fsWidth;
  const height = scaleUiX(36);
  const pos = townUpdateButtonPosition(
    scene,
    safe,
    width,
    height,
    fsWidth,
    fsHeight,
  );
  const statusText = scene.add
    .text(
      pos.x,
      pos.y + height / 2 + scaleUiX(4),
      "",
      uiTextStyle(scene, {
        fontSize: `${scaleUiX(12)}px`,
        color: PALETTE_CSS.blue300,
        align: "center",
        wordWrap: { width: width + scaleUiX(16) },
      }),
    )
    .setOrigin(0.5, 0)
    .setDepth(200);

  let inFlight = false;
  const setStatus = (status: UpdateStatus): void => {
    statusText.setText(formatUpdateStatus(status));
  };

  const updateButton = createTouchButton(
    scene,
    pos.x,
    pos.y,
    "Check for update",
    () => {
      if (inFlight) return;
      inFlight = true;
      void import("../../appUpdate/runCheckForUpdate")
        .then(({ runCheckForUpdate }) => runCheckForUpdate(setStatus))
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Update check failed";
          setStatus({ kind: "error", message });
        })
        .finally(() => {
          inFlight = false;
        });
    },
    {
      width,
      height,
      depth: 200,
      fontSize: `${scaleUiX(12)}px`,
      fillColor: PALETTE.deepNavy,
      strokeColor: PALETTE.blue400,
    },
  );

  return { updateButton };
}

/** Status block text: night/gold, wall, build id lines. */
export function formatTownStatus(save: SaveGame, store: DataStore): string {
  const wall = save.buildings.wall ?? 0;
  const wallDef = store.buildings.wall;
  const wallCost =
    wall < (wallDef?.maxLevel ?? 0) ? wallDef?.costByLevel[wall] : undefined;
  const embedded = getEmbeddedBuildId();
  const urlB =
    typeof window !== "undefined"
      ? new URL(window.location.href).searchParams.get("b")
      : null;
  return [
    `Night ${save.night} · Gold ${save.gold}`,
    `Wall L${wall} (HP ${save.townWallHp}/${save.townWallHpMax})${wallCost !== undefined ? ` — next ${wallCost}g` : ""}`,
    townBuildIdLine(embedded, urlB),
  ].join("\n");
}
