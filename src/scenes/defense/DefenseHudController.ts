import type Phaser from "phaser";
import type { AttackMode } from "../../config";
import type { SaveGame } from "../../core/saveTypes";
import { scaleUiX } from "../../core/displayScale";
import { UI_TEXTURE } from "../../content/assets";
import { isE2EEnabled } from "../../e2e/e2eMode";
import { VirtualStick } from "../../input/VirtualStick";
import type { Player } from "../../entities/Player";
import { SpellCastController } from "../../combat/SpellCastController";
import { CastBar } from "../../ui/CastBar";
import { SpellBar } from "../../ui/SpellBar";
import {
  createCombatHudChrome,
  type CombatHudChrome,
} from "../../ui/combatHudChrome";
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
import { DEFENSE_TOP_CHROME_TRIM_PX } from "../../ui/defenseHudLayout";
import {
  createTouchButton,
  createTouchCircleButton,
  createTouchToggleButton,
} from "../../ui/touchButton";
import type { TouchButtonHandle } from "../../ui/touchButton";
import { uiTextStyle } from "../../ui/uiTextStyle";
import {
  createDefenseTopHud,
  defenseTopHudLayout,
  type DefenseTopHud,
} from "../../ui/defenseTopHud";
import { frameTouchButton } from "../../ui/uiFrame";
import { hudBandHeight } from "../../ui/screenLayoutCore";
import { runDefenseUiFactory } from "../../world/defenseWorldAddHook";

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

/** Combat HUD chrome, toggles, spell bar, stick mask (REFACTOR_PLAN PR6). */
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
  if (isE2EEnabled() && typeof window !== "undefined") {
    (
      window as typeof window & { __HUD_DEBUG__?: Record<string, unknown> }
    ).__HUD_DEBUG__ = {
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
    const dbg = (
      window as typeof window & { __HUD_DEBUG__?: Record<string, unknown> }
    ).__HUD_DEBUG__;
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
      depth: 200,
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

  // Potion / bomb: bottom-left above the HUD strip, mirroring Debug (hidden with no charges).
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
    const btn = createTouchButton(scene, x, dbgPos.y, label, onTap, {
      width: bw,
      height: bh,
      depth: 200,
      fontSize: "18px",
      fillColor: fill,
      strokeColor: stroke,
      tapPadding: scaleUiX(6),
    });
    frameTouchButton(scene, btn.container, frameName, bw, bh);
    btn.container.setData("testid", testId);
    btn.container.setVisible(false);
    registerUi(btn.container);
    uiBlockers.push(btn.container);
    return btn;
  };
  const potionX = safe.left + scaleUiX(8 + 44);
  const potionBtn = consumableBtn(
    potionX,
    "Potion",
    deps.onUsePotion,
    0x7f1d1d,
    0xf87171,
    "defense-potion",
    "btnRed",
  );
  const bombBtn = consumableBtn(
    potionX + scaleUiX(96),
    "Bomb",
    deps.onUseBomb,
    0x78350f,
    0xfbbf24,
    "defense-bomb",
    "btnDark",
  );

  let leaveEndlessBtn: TouchButtonHandle | null = null;
  if (deps.endless || deps.wavePlanner) {
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
    registerUi(leaveEndlessBtn.container);
    uiBlockers.push(leaveEndlessBtn.container);
  }

  const minimap = new DefenseMinimap(scene, registerUi);
  const minimapLayout = defenseMinimapLayout(scene, safe);
  minimap.addFrame(scene, minimapLayout, registerUi);
  if (isE2EEnabled() && typeof window !== "undefined") {
    const dbg = (
      window as typeof window & { __HUD_DEBUG__?: Record<string, unknown> }
    ).__HUD_DEBUG__;
    if (dbg) {
      dbg.minimap = minimapLayout;
    }
  }

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
