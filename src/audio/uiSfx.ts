import type Phaser from "phaser";
import { sfxVolumes } from "../config/audio";

/** Town menu sounds (CC0 clips, see CREDITS.md). Keys match `UI_SFX_ASSETS`. */
export type UiSfx =
  | "panelOpen"
  | "panelClose"
  | "click"
  | "tab"
  | "sell"
  | "equip"
  | "upgrade"
  | "error";

const KEYS: Record<UiSfx, string> = {
  panelOpen: "sfx_ui_panel_open",
  panelClose: "sfx_ui_panel_close",
  click: "sfx_ui_click",
  tab: "sfx_ui_tab",
  sell: "sfx_ui_sell",
  equip: "sfx_ui_equip",
  upgrade: "sfx_ui_upgrade",
  error: "sfx_ui_error",
};

type AudioVolumes = ReturnType<typeof sfxVolumes>;

const VOLUME: Record<UiSfx, (v: AudioVolumes) => number> = {
  panelOpen: (v) => v.uiPanelVolume,
  panelClose: (v) => v.uiPanelVolume,
  click: (v) => v.uiClickVolume,
  tab: (v) => v.uiClickVolume,
  sell: (v) => v.uiSellVolume,
  equip: (v) => v.uiEquipVolume,
  upgrade: (v) => v.uiUpgradeVolume,
  error: (v) => v.uiErrorVolume,
};

/** Play a town menu sound; silent when the clip has not loaded (tests, slow loads). */
export function playUiSfx(scene: Phaser.Scene, id: UiSfx): void {
  const key = KEYS[id];
  if (!scene.cache?.audio?.exists(key)) return;
  scene.sound.play(key, { volume: VOLUME[id](sfxVolumes()) });
}
