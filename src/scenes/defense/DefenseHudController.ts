import Phaser from "phaser";
import type { AttackMode } from "../../config";
import type { SaveGame } from "../../core/saveTypes";
import { scaleUiX } from "../../core/displayScale";
import { UI_TEXTURE } from "../../content/assets";
import { isE2EEnabled } from "../../e2e/e2eMode";
import { VirtualStick } from "../../input/VirtualStick";
import { Player } from "../../entities/Player";
import { SpellCastController } from "../../combat/SpellCastController";
import { CastBar } from "../../ui/CastBar";
import { SpellBar } from "../../ui/SpellBar";
import { createCombatHudChrome, type CombatHudChrome } from "../../ui/combatHudChrome";
import {
  DefenseMinimap,
  defenseMinimapLayout,
  defenseMinimapScreenRect,
} from "../../ui/defenseMinimap";
import { defensePlayAreaLayout } from "../../ui/screenLayout";
import {
  buildCombatStickUiMask,
  bottomHudStripLayout,
  combatChromeLayout,
  combatDebugButtonPosition,
  hudTextPosition,
  nightReturnButtonPosition,
  readSafeInsets,
  type SafeInsets,
} from "../../ui/screenLayout";
import {
  createTouchButton,
  createTouchCircleButton,
  createTouchToggleButton,
} from "../../ui/touchButton";
import type { TouchButtonHandle } from "../../ui/touchButton";
import { uiTextStyle } from "../../ui/uiTextStyle";
import { runDefenseUiFactory } from "../../world/defenseWorldAddHook";

export type DefenseHudControllerDeps = {
  scene: Phaser.Scene;
  save: SaveGame;
  player: Player;
  endless: boolean;
  registerUiDraw: (go: Phaser.GameObjects.GameObject) => void;
  onManualAttack: () => void;
  onSpellCastRequest: (spellId: string) => void;
  onSpellAutoCastToggle: (slotIndex: number) => void;
  onGroundCastArm: (spellId: string, pointer: Phaser.Input.Pointer) => void;
  onGroundCastCancel: () => void;
  onOpenDebugMenu: () => void;
  onLeaveEndless: () => void;
  getAutoAttackEnabled: () => boolean;
  setAutoAttackEnabled: (on: boolean) => void;
};

export type DefenseHudBuild = {
  safe: SafeInsets;
  hudChrome: CombatHudChrome;
  attackButton: Phaser.GameObjects.Container;
  modeToggle: ReturnType<typeof createTouchToggleButton>;
  autoToggle: ReturnType<typeof createTouchToggleButton>;
  spellCaster: SpellCastController;
  castBar: CastBar;
  spellBar: SpellBar;
  hudText: Phaser.GameObjects.Text;
  debugBtn: TouchButtonHandle;
  leaveEndlessBtn: TouchButtonHandle | null;
  minimap: DefenseMinimap;
  minimapLayout: ReturnType<typeof defenseMinimapLayout>;
  stick: VirtualStick;
  uiBlockers: Phaser.GameObjects.GameObject[];
  refreshModeToggle: (mode: AttackMode) => void;
  refreshAutoToggle: () => void;
  setHudChromeVisible: (visible: boolean) => void;
};

/** Combat HUD chrome, toggles, spell bar, stick mask (REFACTOR_PLAN PR6). */
export function createDefenseHudController(
  deps: DefenseHudControllerDeps,
): DefenseHudBuild {
  return runDefenseUiFactory(deps.scene, () => buildDefenseHudController(deps));
}

function buildDefenseHudController(
  deps: DefenseHudControllerDeps,
): DefenseHudBuild {
  const { scene } = deps;
  const registerUi = deps.registerUiDraw;
  const safe = readSafeInsets();
  const chrome = combatChromeLayout(scene, safe);
  const hudChrome = createCombatHudChrome(scene, safe);
  for (const root of hudChrome.roots) {
    registerUi(root);
  }

  const bottomStrip = bottomHudStripLayout(scene, safe);
  const playArea = defensePlayAreaLayout(scene, safe);
  if (isE2EEnabled() && typeof window !== "undefined") {
    (window as typeof window & { __HUD_DEBUG__?: Record<string, unknown> }).__HUD_DEBUG__ =
      {
        bottomChromeTextureKey: null,
        stripCenterY: bottomStrip.stripCenterY,
        stripH: bottomStrip.stripH,
        playAreaY: playArea.y,
        playAreaBottom: playArea.y + playArea.height,
        playAreaHeight: playArea.height,
      };
  }

  const attackButton = createTouchCircleButton(
    scene,
    chrome.atkX,
    chrome.btnY,
    "ATK",
    chrome.atkRadius,
    deps.onManualAttack,
    210,
    UI_TEXTURE.atkCircle,
  );
  registerUi(attackButton);

  let refreshModeToggle!: (mode: AttackMode) => void;
  let refreshAutoToggle!: () => void;

  const modeToggle = createTouchToggleButton(
    scene,
    chrome.modeX,
    chrome.modeY,
    "MEL",
    chrome.toggleW,
    chrome.toggleH,
    () => {
      const mode = deps.player.cycleAttackMode();
      refreshModeToggle(mode);
    },
    210,
    {
      frameTextureKey: UI_TEXTURE.modeRect,
      onBgTint: 0xe8d4a8,
      offBgTint: 0xffffff,
      onTextColor: "#fde68a",
      offTextColor: "#e8dcc8",
    },
  );
  registerUi(modeToggle.container);

  const autoToggle = createTouchToggleButton(
    scene,
    chrome.autoX,
    chrome.autoY,
    "AUTO\nOFF",
    chrome.toggleW,
    chrome.toggleH,
    () => {
      deps.setAutoAttackEnabled(!deps.getAutoAttackEnabled());
      refreshAutoToggle();
    },
    210,
    {
      frameTextureKey: UI_TEXTURE.autoRect,
      onBgTint: 0xa8d8a0,
      offBgTint: 0xffffff,
      onTextColor: "#bef264",
      offTextColor: "#a8a29e",
    },
  );
  registerUi(autoToggle.container);

  const spellCaster = new SpellCastController();
  const castBar = new CastBar(scene);
  const spellBar = new SpellBar(
    scene,
    deps.save.spellBar.slots,
    deps.save.spellBar.autoCastSpellIds,
    spellCaster,
    {
      onCastRequest: (id) => deps.onSpellCastRequest(id),
      onAutoCastToggle: (slot) => deps.onSpellAutoCastToggle(slot),
      onGroundCastArm: (id, pointer) => deps.onGroundCastArm(id, pointer),
      onGroundCastCancel: () => deps.onGroundCastCancel(),
    },
  );
  spellBar.refreshAutoCastBorders(
    deps.save.spellBar.slots,
    deps.save.spellBar.autoCastSpellIds,
  );
  for (const c of spellBar.getUiContainers()) {
    registerUi(c);
  }

  if (isE2EEnabled() && typeof window !== "undefined") {
    const dbg = (window as typeof window & { __HUD_DEBUG__?: Record<string, unknown> })
      .__HUD_DEBUG__;
    const spell0 = spellBar.e2eSlotTapCenters()[0];
    if (dbg) {
      dbg.spellSlot0CanvasY = spell0?.y ?? null;
    }
  }

  const uiBlockers: Phaser.GameObjects.GameObject[] = [
    attackButton,
    modeToggle.container,
    autoToggle.container,
    ...spellBar.getUiContainers(),
  ];

  const hudPos = hudTextPosition(safe);
  const hudText = scene.add
    .text(
      hudPos.x,
      hudPos.y,
      "",
      uiTextStyle(scene, {
        fontSize: `${scaleUiX(16)}px`,
        color: "#fafafa",
      }),
    )
    .setScrollFactor(0)
    .setDepth(200);
  registerUi(hudText);

  const dbgPos = combatDebugButtonPosition(scene, safe);
  const debugBtn = createTouchButton(
    scene,
    dbgPos.x,
    dbgPos.y,
    "Debug",
    deps.onOpenDebugMenu,
    {
      width: scaleUiX(88),
      height: scaleUiX(36),
      depth: 200,
      fontSize: `${scaleUiX(14)}px`,
      fillColor: 0x3f3f46,
      strokeColor: 0xa1a1aa,
    },
  );
  registerUi(debugBtn.container);
  uiBlockers.push(debugBtn.container);

  let leaveEndlessBtn: TouchButtonHandle | null = null;
  if (deps.endless) {
    const leaveBtn = nightReturnButtonPosition(scene, safe);
    leaveEndlessBtn = createTouchButton(
      scene,
      leaveBtn.x,
      leaveBtn.y,
      "Return to town",
      deps.onLeaveEndless,
      {
        width: leaveBtn.width,
        height: leaveBtn.height,
        depth: 210,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x52525b,
        strokeColor: 0xa1a1aa,
      },
    );
    leaveEndlessBtn.container.setData("testid", "defense-leave-endless");
    registerUi(leaveEndlessBtn.container);
    uiBlockers.push(leaveEndlessBtn.container);
  }

  const minimap = new DefenseMinimap(scene, registerUi);
  const minimapLayout = defenseMinimapLayout(scene, safe);
  if (isE2EEnabled() && typeof window !== "undefined") {
    const dbg = (window as typeof window & { __HUD_DEBUG__?: Record<string, unknown> })
      .__HUD_DEBUG__;
    if (dbg) {
      dbg.minimap = minimapLayout;
    }
  }

  const w = scene.scale.width;
  const h = scene.scale.height;
  const spellRect = spellBar.getScreenRect();
  const uiMask = buildCombatStickUiMask(scene, chrome, spellRect, debugBtn.container);
  const minimapRect = defenseMinimapScreenRect(scene, safe);
  const playBelowY = playArea.y + playArea.height;
  const stick = new VirtualStick(scene, {
    blockers: uiBlockers,
    excludeZones: [
      { x: 0, y: 0, width: w, height: playArea.y },
      { x: 0, y: playBelowY, width: w, height: Math.max(0, h - playBelowY) },
    ],
    uiScreenRects: [...uiMask, minimapRect],
    dragThresholdPx: chrome.stickDragThreshold,
    radius: chrome.stickRadius,
    registerUiDraw: registerUi,
  });

  refreshModeToggle = (mode: AttackMode) => {
    const label =
      mode === "melee" ? "MEL" : mode === "ranged" ? "RNG" : "A.COM";
    modeToggle.setLabel(label);
    modeToggle.setOn(mode === "ranged" || mode === "auto");
  };

  refreshAutoToggle = () => {
    const on = deps.getAutoAttackEnabled();
    autoToggle.setOn(on);
    autoToggle.setLabel(on ? "AUTO\nON" : "AUTO\nOFF");
  };

  const setHudChromeVisible = (visible: boolean) => {
    hudText.setVisible(visible);
    debugBtn.container.setVisible(visible);
    hudChrome?.setVisible(visible);
    minimap?.setVisible(visible);
  };

  refreshModeToggle(deps.player.mode);
  refreshAutoToggle();

  return {
    safe,
    hudChrome,
    attackButton,
    modeToggle,
    autoToggle,
    spellCaster,
    castBar,
    spellBar,
    hudText,
    debugBtn,
    leaveEndlessBtn,
    minimap,
    minimapLayout,
    stick,
    uiBlockers,
    refreshModeToggle,
    refreshAutoToggle,
    setHudChromeVisible,
  };
}