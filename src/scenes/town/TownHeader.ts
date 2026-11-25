import type Phaser from "phaser";
import { getEmbeddedBuildId, townBuildIdLine } from "../../buildId";
import { GAME } from "../../config";
import type { DataStore } from "../../core/DataStore";
import { playerDamageMult } from "../../core/GameState";
import type { SaveGame } from "../../core/saveTypes";
import { scaleUiX } from "../../core/displayScale";
import { toggleFullscreen, fullscreenButtonLabel } from "../../ui/fullscreen";
import {
  debugButtonPosition,
  readSafeInsets,
  townFullscreenButtonPosition,
  townResetSaveButtonPosition,
  townStatusTextTopY,
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
        color: "#f4f4f5",
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
        color: "#a1a1aa",
        align: "center",
        wordWrap: { width: GAME.width - scaleUiX(48) },
      }),
    )
    .setOrigin(0.5, 0);
}

export type TownHeaderButtons = {
  debugButton: TouchButton;
  fullscreenButton: TouchButton;
  resetButton: TouchButton;
};

/** Debug, fullscreen and reset-save buttons (created in that order). */
export function createTownHeaderButtons(
  scene: Phaser.Scene,
  handlers: { onDebug: () => void; onReset: () => void },
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
      fillColor: 0x3f3f46,
      strokeColor: 0xa1a1aa,
    },
  );

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
      fillColor: 0x1e3a5f,
      strokeColor: 0x60a5fa,
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
      fillColor: 0x7f1d1d,
      strokeColor: 0xf87171,
    },
  );

  return { debugButton, fullscreenButton, resetButton };
}

/** Status block text: night/gold, wall, blacksmith, build id lines. */
export function formatTownStatus(save: SaveGame, store: DataStore): string {
  const wall = save.buildings.wall ?? 0;
  const smith = save.buildings.blacksmith ?? 0;
  const dmg = playerDamageMult(save.buildings).toFixed(2);
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
    `Blacksmith L${smith} (damage x${dmg})`,
    townBuildIdLine(embedded, urlB),
  ].join("\n");
}
