import type Phaser from "phaser";
import { PALETTE, PALETTE_CSS } from "../../ui/theme/uiPalette";
import { isNativeApp } from "../../appUpdate/isNativeApp";
import {
  formatUpdateStatus,
  type UpdateStatus,
} from "../../appUpdate/checkForUpdate";
import { getEmbeddedBuildId, townBuildIdLine } from "../../buildId";
import { GAME } from "../../config";
import type { DataStore } from "../../core/DataStore";
import type { SaveGame } from "../../core/saveTypes";
import { scaleUiX } from "../../config/uiScale";
import { toggleFullscreen, fullscreenButtonLabel } from "../../ui/fullscreen";
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
} from "../../ui/screenLayout";
import { createTouchButton } from "../../ui/touchButton";
import { uiTextStyle } from "../../ui/uiTextStyle";

type TouchButton = ReturnType<typeof createTouchButton>;

/** Background, "Town — Day" title, and the (empty) status text block. */
export function createTownHeader(scene: Phaser.Scene): Phaser.GameObjects.Text {
  scene.add.rectangle(0, 0, GAME.width, GAME.height, 0x1a1c24).setOrigin(0);

  const titleY = townTitleY();
  scene.add
    .text(
      GAME.width / 2,
      titleY,
      "Town — Day",
      uiTextStyle(scene, {
        fontSize: `${scaleUiX(28)}px`,
        color: PALETTE_CSS.zinc100,
      }),
    )
    .setOrigin(0.5);

  return scene.add
    .text(
      GAME.width / 2,
      townStatusTextTopY(),
      "",
      uiTextStyle(scene, {
        fontSize: `${scaleUiX(18)}px`,
        color: PALETTE_CSS.zinc400,
        align: "center",
        wordWrap: { width: GAME.width - scaleUiX(48) },
      }),
    )
    .setOrigin(0.5, 0);
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
