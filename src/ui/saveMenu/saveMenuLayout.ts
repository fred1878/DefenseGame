import { GAME } from "../../config";
import { scaleUiX, scaleUiY } from "../../config/uiScale";
import { PALETTE } from "../theme/uiPalette";

/** Save menu action buttons, in creation (and draw) order. */
export type SaveMenuButtonId =
  | "save"
  | "load"
  | "delete"
  | "confirm"
  | "cancel"
  | "close";

export type SaveMenuButtonSpec = {
  id: SaveMenuButtonId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSizePx: number;
  fill: number;
  stroke: number;
};

export type SaveMenuLayout = {
  titleY: number;
  titleFontPx: number;
  introY: number;
  introFontPx: number;
  introWrapW: number;
  /** Slot rows: centred, `rowW` wide, stacked from `listTop` with `gap`. */
  rowW: number;
  rowH: number;
  gap: number;
  listLeft: number;
  listTop: number;
  rowTextInsetX: number;
  rowTitleOffsetY: number;
  rowMetaOffsetY: number;
  rowTitleFontPx: number;
  rowMetaFontPx: number;
  rowMetaLineSpacing: number;
  promptY: number;
  promptFontPx: number;
  promptWrapW: number;
  buttonDepth: number;
  buttons: SaveMenuButtonSpec[];
};

/** Centre y of slot row `index`. */
export function saveMenuRowCenterY(l: SaveMenuLayout, index: number): number {
  return l.listTop + index * (l.rowH + l.gap) + l.rowH / 2;
}

/** Where everything in the Town save menu goes (pure; drawn by `SaveMenuPanel`). */
export function saveMenuLayout(): SaveMenuLayout {
  const rowW = GAME.width - scaleUiX(48);
  const actionY = GAME.height - scaleUiY(148);
  const btnW = scaleUiX(140);
  const btnH = scaleUiY(48);
  const mid = GAME.width / 2;
  const gapX = scaleUiX(154);
  const fontPx = scaleUiX(16);
  const action = (
    id: SaveMenuButtonId,
    label: string,
    x: number,
    fill: number,
    stroke: number,
  ): SaveMenuButtonSpec => ({
    id,
    label,
    x,
    y: actionY,
    width: btnW,
    height: btnH,
    fontSizePx: fontPx,
    fill,
    stroke,
  });
  return {
    titleY: scaleUiY(64),
    titleFontPx: scaleUiX(24),
    introY: scaleUiY(98),
    introFontPx: scaleUiX(13),
    introWrapW: GAME.width - scaleUiX(36),
    rowW,
    rowH: scaleUiY(88),
    gap: scaleUiY(10),
    listLeft: (GAME.width - rowW) / 2,
    listTop: scaleUiY(176),
    rowTextInsetX: scaleUiX(16),
    rowTitleOffsetY: -scaleUiY(18),
    rowMetaOffsetY: scaleUiY(16),
    rowTitleFontPx: scaleUiX(18),
    rowMetaFontPx: scaleUiX(13),
    rowMetaLineSpacing: scaleUiY(2),
    promptY: GAME.height - scaleUiY(214),
    promptFontPx: scaleUiX(15),
    promptWrapW: GAME.width - scaleUiX(40),
    buttonDepth: 510,
    buttons: [
      action("save", "Save", mid - gapX, PALETTE.green700, PALETTE.green400),
      action("load", "Load", mid, PALETTE.blue700, PALETTE.blue400),
      action("delete", "Delete", mid + gapX, 0x9f1239, PALETTE.rose400),
      action(
        "confirm",
        "Confirm",
        mid - scaleUiX(80),
        PALETTE.green700,
        PALETTE.green400,
      ),
      action(
        "cancel",
        "Cancel",
        mid + scaleUiX(80),
        PALETTE.zinc600,
        PALETTE.zinc400,
      ),
      {
        id: "close",
        label: "Close",
        x: mid,
        y: GAME.height - scaleUiY(80),
        width: scaleUiX(120),
        height: scaleUiY(40),
        fontSizePx: scaleUiX(14),
        fill: PALETTE.zinc600,
        stroke: PALETTE.zinc400,
      },
    ],
  };
}
