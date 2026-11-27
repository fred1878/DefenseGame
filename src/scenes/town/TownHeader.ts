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
  const dbgPos = debugButtonPosition(scene, safe);
  const debugButton = createTouchButton(
    scene,
    dbgPos.x,
    dbgPos.y,
    "Debug",
    () => {
      handlers.onDebug();
    },
    {
      width: scaleUiX(88),
      height: scaleUiX(36),
      depth: 200,
      fontSize: `${scaleUiX(14)}px`,
      fillColor: PALETTE.zinc700,
      strokeColor: PALETTE.zinc400,
    },
  );

  const gearPos = townGearButtonPosition(scene, safe);
  const gearButton = createTouchButton(
    scene,
    gearPos.x,
    gearPos.y,
    "Gear",
    () => handlers.onGear(),
    {
      width: scaleUiX(88),
      height: scaleUiX(36),
      depth: 200,
      fontSize: `${scaleUiX(14)}px`,
      fillColor: 0x713f12,
      strokeColor: PALETTE.amber400,
    },
  );
  gearButton.container.setData("testid", "town-gear");

  const talentsPos = townTalentsButtonPosition(scene, safe);
  const talentsButton = createTouchButton(
    scene,
    talentsPos.x,
    talentsPos.y,
    "Talents",
    () => handlers.onTalents(),
    {
      width: scaleUiX(88),
      height: scaleUiX(36),
      depth: 200,
      fontSize: `${scaleUiX(14)}px`,
      fillColor: 0x3a322b,
      strokeColor: 0xd4a64a,
    },
  );
  talentsButton.container.setData("testid", "town-talents");

  const fsWidth = scaleUiX(168);
  const fsHeight = scaleUiX(36);
  const fsPos = townFullscreenButtonPosition(scene, safe, fsWidth, fsHeight);
  const fsLabel = fullscreenButtonLabel(scene.scale);
  const fullscreenButton = createTouchButton(
    scene,
    fsPos.x,
    fsPos.y,
    fsLabel,
    () => toggleFullscreen(scene.scale),
    {
      width: fsWidth,
      height: fsHeight,
      depth: 200,
      fontSize: `${scaleUiX(13)}px`,
      fillColor: PALETTE.deepNavy,
      strokeColor: PALETTE.blue400,
      activateOn: "pointerup",
    },
  );

  const resetWidth = scaleUiX(118);
  const resetHeight = scaleUiX(36);
  const resetPos = townResetSaveButtonPosition(
    scene,
    safe,
    resetWidth,
    resetHeight,
  );
  const resetButton = createTouchButton(
    scene,
    resetPos.x,
    resetPos.y,
    "Reset save",
    () => handlers.onReset(),
    {
      width: resetWidth,
      height: resetHeight,
      depth: 200,
      fontSize: `${scaleUiX(14)}px`,
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
