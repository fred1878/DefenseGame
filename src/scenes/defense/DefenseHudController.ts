import type Phaser from "phaser";
import { DEFENSE_UI_DEPTH } from "../../config/renderDepth";
import { PALETTE, PALETTE_CSS } from "../../ui/theme/uiPalette";
import type { AttackMode } from "../../config";
import type { SaveGame } from "../../core/save/saveTypes";
import { scaleUiX } from "../../config/uiScale";
import { UI_TEXTURE } from "../../content/assets";
import { isE2EEnabled } from "../../e2e/e2eMode";
import { VirtualStick } from "../../input/VirtualStick";
import type { Player } from "../../entities/Player";
import { SpellCastController } from "../../combat/rules/SpellCastController";
import { CastBar } from "../../ui/hud/CastBar";
import { SpellBar } from "../../ui/hud/SpellBar";
import {
  createCombatHudChrome,
  type CombatHudChrome,
} from "../../ui/hud/combatHudChrome";
import {
  DefenseMinimap,
  defenseMinimapLayout,
  defenseMinimapScreenRect,
} from "../../ui/hud/defenseMinimap";
import { defensePlayAreaLayout } from "../../ui/layout/screenLayout";
import {
  buildCombatStickUiMask,
  bottomHudStripLayout,
  combatChromeLayout,
  combatDebugButtonPosition,
  readSafeInsets,
  type SafeInsets,
} from "../../ui/layout/screenLayout";
import {
  DEFENSE_TOP_CHROME_TRIM_PX,
  hudTextPosition,
} from "../../ui/hud/defenseHudLayout";
import {
  createTouchButton,
  createTouchCircleButton,
  createTouchToggleButton,
} from "../../ui/touch/touchButton";
import type { TouchButtonHandle } from "../../ui/touch/touchButton";
import { uiTextStyle } from "../../ui/layout/uiTextStyle";
import {
  createDefenseTopHud,
  defenseTopHudLayout,
  type DefenseTopHud,
} from "../../ui/hud/defenseTopHud";
import { frameTouchButton } from "../../ui/layout/uiFrame";
import { hudBandHeight } from "../../ui/layout/screenLayoutCore";
import { runDefenseUiFactory } from "../../world/defenseWorldAddHook";
import {
  createDefenseHudActionButtons,
  publishHudDebug,
} from "./DefenseHudButtons";

export type DefenseHudControllerDeps = {
  scene: Phaser.Scene;
  save: SaveGame;
  player: Player;
  endless: boolean;
  /** Custom wave planner — same leave-to-town affordance as endless. */
  wavePlanner: boolean;
  registerUiDraw: (go: Phaser.GameObjects.GameObject) => void;
  onManualAttack: () => void;
  onSpellCastRequest: (spellId: string) => void;
  onSpellAutoCastToggle: (slotIndex: number) => void;
  onGroundCastArm: (spellId: string, pointer: Phaser.Input.Pointer) => void;
  onGroundCastCancel: () => void;
  onOpenDebugMenu: () => void;
  onLeaveEndless: () => void;
  onUsePotion: () => void;
  onUseBomb: () => void;
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
  topHud: DefenseTopHud;
  debugBtn: TouchButtonHandle;
  potionBtn: TouchButtonHandle;
  bombBtn: TouchButtonHandle;
  leaveEndlessBtn: TouchButtonHandle | null;
  minimap: DefenseMinimap;
  minimapLayout: ReturnType<typeof defenseMinimapLayout>;
  stick: VirtualStick;
  uiBlockers: Phaser.GameObjects.GameObject[];
  refreshModeToggle: (mode: AttackMode) => void;
  refreshAutoToggle: () => void;
  setHudChromeVisible: (visible: boolean) => void;
};

/** Combat HUD chrome, toggles, spell bar, stick mask; action buttons in `DefenseHudButtons`. */
export function createDefenseHudController(
  deps: DefenseHudControllerDeps,
): DefenseHudBuild {
  return runDefenseUiFactory(deps.scene, () => buildDefenseHudController(deps));
}

/** Mirrors DEFENSE_TOP_CHROME_TRIM_PX: the visible top band is the HUD band minus this. */
const DEFENSE_TOP_TRIM = DEFENSE_TOP_CHROME_TRIM_PX;

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
  publishHudDebug(
    {
      bottomChromeTextureKey: null,
      stripCenterY: bottomStrip.stripCenterY,
      stripH: bottomStrip.stripH,
      playAreaY: playArea.y,
      playAreaBottom: playArea.y + playArea.height,
      playAreaHeight: playArea.height,
    },
    true,
  );

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
      offBgTint: PALETTE.white,
      onTextColor: PALETTE_CSS.amber200,
      offTextColor: PALETTE_CSS.parchmentDim,
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
      offBgTint: PALETTE.white,
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

  if (isE2EEnabled()) {
    publishHudDebug({
      spellSlot0CanvasY: spellBar.e2eSlotTapCenters()[0]?.y ?? null,
    });
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
        color: PALETTE_CSS.zinc50,
      }),
    )
    .setScrollFactor(0)
    .setDepth(DEFENSE_UI_DEPTH.hud);
  registerUi(hudText);

  const topHud = createDefenseTopHud(
    scene,
    defenseTopHudLayout(
      scene.scale.width,
      safe.top,
      hudBandHeight(safe.top) - DEFENSE_TOP_TRIM,
    ),
  );
  for (const r of topHud.roots) registerUi(r);

  const tl = topHud.layout;
  const debugBtn = createTouchButton(
    scene,
    tl.debugX + tl.debugW / 2,
    tl.debugY + tl.debugH / 2,
    "Debug",
    deps.onOpenDebugMenu,
    {
      width: tl.debugW,
      height: tl.debugH,
      depth: DEFENSE_UI_DEPTH.hud,
      fontSize: "16px",
      fillColor: 0x1c1714,
      strokeColor: 0x1c1714,
      tapPadding: 6,
    },
  );
  frameTouchButton(scene, debugBtn.container, "btn", tl.debugW, tl.debugH);
  registerUi(debugBtn.container);
  uiBlockers.push(debugBtn.container);
  const dbgPos = combatDebugButtonPosition(scene, safe);

  const { potionBtn, bombBtn, leaveEndlessBtn } = createDefenseHudActionButtons(
    {
      scene,
      safe,
      rowY: dbgPos.y,
      showLeave: deps.endless || deps.wavePlanner,
      onUsePotion: deps.onUsePotion,
      onUseBomb: deps.onUseBomb,
      onLeave: deps.onLeaveEndless,
    },
    (go) => {
      registerUi(go);
      uiBlockers.push(go);
    },
  );

  const minimap = new DefenseMinimap(scene, registerUi);
  const minimapLayout = defenseMinimapLayout(scene, safe);
  minimap.addFrame(scene, minimapLayout, registerUi);
  publishHudDebug({ minimap: minimapLayout });

  const w = scene.scale.width;
  const h = scene.scale.height;
  const spellRect = spellBar.getScreenRect();
  const uiMask = buildCombatStickUiMask(
    scene,
    chrome,
    spellRect,
    debugBtn.container,
  );
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
    topHud.setVisible(visible);
    debugBtn.container.setVisible(visible);
    if (!visible) {
      potionBtn.container.setVisible(false);
      bombBtn.container.setVisible(false);
    }
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
    topHud,
    debugBtn,
    potionBtn,
    bombBtn,
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

export type DefenseHudTextInput = {
  header: string;
  wallHp: number;
  playerHp: number;
  playerHpMax: number;
  infiniteHp: boolean;
  invulnerable: boolean;
  livingEnemies: number;
  hasFocus: boolean;
  mode: AttackMode;
  autoAttackEnabled: boolean;
  castPhase: "windup" | "channeling" | null;
  castPct: number;
  attackPhase: string;
};

/** Four-line night HUD text (header/wall, HP, enemies/mode, cast or hint line). */
export function formatDefenseHudText(input: DefenseHudTextInput): string {
  const focus = input.hasFocus ? " (focus)" : "";
  const mode =
    input.mode === "melee"
      ? "Melee"
      : input.mode === "ranged"
        ? "Ranged"
        : "Auto combat";
  const auto = input.autoAttackEnabled ? "ON" : "OFF";
  const castLine = (() => {
    if (!input.castPhase) {
      return input.attackPhase !== "idle"
        ? `ATK: ${input.attackPhase}`
        : "Spells · tap enemy to focus · drag to move";
    }
    const verb = input.castPhase === "windup" ? "Casting" : "Channeling";
    return `${verb}… ${input.castPct}%`;
  })();
  return [
    `${input.header} · Wall ${Math.max(0, Math.floor(input.wallHp))}`,
    `HP ${Math.floor(input.playerHp)}/${input.playerHpMax}${input.infiniteHp ? " · ∞" : ""}${input.invulnerable ? " (i-frames)" : ""}`,
    `Enemies ${input.livingEnemies}${focus} · ${mode} · Auto ${auto}`,
    castLine,
  ].join("\n");
}
