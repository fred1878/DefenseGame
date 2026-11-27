import type Phaser from "phaser";
import { DEFENSE_UI_DEPTH } from "../../config/renderDepth";
import { scaleUiX } from "../../config/uiScale";
import { isE2EEnabled } from "../../e2e/e2eMode";
import { PALETTE } from "../../ui/theme/uiPalette";
import {
  nightReturnButtonPosition,
  type SafeInsets,
} from "../../ui/layout/screenLayout";
import {
  createTouchButton,
  type TouchButtonHandle,
} from "../../ui/touch/touchButton";
import { frameTouchButton } from "../../ui/layout/uiFrame";

type HudDebugWindow = typeof window & {
  __HUD_DEBUG__?: Record<string, unknown>;
};

/**
 * E2E mode: write HUD layout probes to `window.__HUD_DEBUG__` (`reset` starts
 * a new object; otherwise fields merge into an existing one).
 */
export function publishHudDebug(
  fields: Record<string, unknown>,
  reset = false,
): void {
  if (!isE2EEnabled() || typeof window === "undefined") return;
  const w = window as HudDebugWindow;
  if (reset) {
    w.__HUD_DEBUG__ = { ...fields };
    return;
  }
  if (w.__HUD_DEBUG__) Object.assign(w.__HUD_DEBUG__, fields);
}

export type DefenseHudActionButtonsInput = {
  scene: Phaser.Scene;
  safe: SafeInsets;
  /** Potion / bomb row y (level with the Debug button position). */
  rowY: number;
  /** Endless / wave planner: add the "Return to town" leave button. */
  showLeave: boolean;
  onUsePotion: () => void;
  onUseBomb: () => void;
  onLeave: () => void;
};

/**
 * Potion / bomb (bottom-left above the HUD strip, hidden with no charges) and
 * the endless / wave-planner leave button. `addUi` registers each with the UI
 * camera and the stick blockers, in creation order.
 */
export function createDefenseHudActionButtons(
  input: DefenseHudActionButtonsInput,
  addUi: (go: Phaser.GameObjects.Container) => void,
): {
  potionBtn: TouchButtonHandle;
  bombBtn: TouchButtonHandle;
  leaveEndlessBtn: TouchButtonHandle | null;
} {
  const { scene, safe } = input;
  const consumableBtn = (
    x: number,
    label: string,
    onTap: () => void,
    fill: number,
    stroke: number,
    testId: string,
    frameName: "btnRed" | "btnDark",
  ): TouchButtonHandle => {
    const bw = scaleUiX(88);
    const bh = scaleUiX(36);
    const btn = createTouchButton(scene, x, input.rowY, label, onTap, {
      width: bw,
      height: bh,
      depth: DEFENSE_UI_DEPTH.hud,
      fontSize: "18px",
      fillColor: fill,
      strokeColor: stroke,
      tapPadding: scaleUiX(6),
    });
    frameTouchButton(scene, btn.container, frameName, bw, bh);
    btn.container.setData("testid", testId);
    btn.container.setVisible(false);
    addUi(btn.container);
    return btn;
  };
  const potionX = safe.left + scaleUiX(8 + 44);
  const potionBtn = consumableBtn(
    potionX,
    "Potion",
    input.onUsePotion,
    PALETTE.red900,
    PALETTE.red400,
    "defense-potion",
    "btnRed",
  );
  const bombBtn = consumableBtn(
    potionX + scaleUiX(96),
    "Bomb",
    input.onUseBomb,
    0x78350f,
    PALETTE.amber400,
    "defense-bomb",
    "btnDark",
  );

  let leaveEndlessBtn: TouchButtonHandle | null = null;
  if (input.showLeave) {
    const leaveBtn = nightReturnButtonPosition(scene, safe);
    leaveEndlessBtn = createTouchButton(
      scene,
      leaveBtn.x,
      leaveBtn.y,
      "Return to town",
      input.onLeave,
      {
        width: leaveBtn.width,
        height: leaveBtn.height,
        depth: DEFENSE_UI_DEPTH.hudOverlayButton,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x1c1714,
        strokeColor: 0x1c1714,
      },
    );
    frameTouchButton(
      scene,
      leaveEndlessBtn.container,
      "btnDark",
      leaveBtn.width,
      leaveBtn.height,
    );
    leaveEndlessBtn.container.setData("testid", "defense-leave-endless");
    addUi(leaveEndlessBtn.container);
  }
  return { potionBtn, bombBtn, leaveEndlessBtn };
}
