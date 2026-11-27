import { afterEach, describe, expect, it, vi } from "vitest";
import { CAST_BAR, DEFENSE_RENDER_DEPTH } from "../../config";
import { asScene, fakeScene, type FakeGameObject } from "../../test/fakeScene";
import { CastBar } from "./CastBar";
import { createCombatHudChrome } from "./combatHudChrome";
import { GroundTargetReticle } from "./GroundTargetReticle";
import {
  defensePlayAreaLayout,
  defenseTopChromeHeight,
} from "../layout/screenLayout";
import {
  bindViewportToScale,
  cameraWorldPoint,
  hudBandHeight,
  readSafeInsets,
} from "../layout/screenLayoutCore";
import { TargetIndicator } from "./TargetIndicator";
import {
  createUiRoundedRect,
  isUiRoundedRect,
  paintUiRoundedRect,
} from "../layout/uiRoundedRect";

describe("GroundTargetReticle", () => {
  it("starts hidden and draws a glow, dashed ring and pip at the aim point when shown", () => {
    const scene = fakeScene();
    const reticle = new GroundTargetReticle(asScene(scene));
    const gfx = reticle.worldGraphics() as unknown as FakeGameObject;
    expect(gfx.visible).toBe(false);
    expect(gfx.last("setDepth")).toEqual([24]);

    reticle.showAt(100, 200, 50, "ice");
    expect(gfx.visible).toBe(true);
    expect(gfx.callsTo("fillCircle")).toEqual([
      [100, 200, 50],
      [100, 200, 35],
      [100, 200, 20],
      [100, 200, 3],
    ]);
    expect(gfx.callsTo("arc")).toHaveLength(12);
    expect(gfx.callsTo("lineStyle")[0]).toEqual([2, 0x38bdf8, 0.95]);

    reticle.updatePosition(110, 210);
    expect(gfx.last("fillCircle")).toEqual([110, 210, 3]);
  });

  it("ignores moves while hidden and colours by style", () => {
    const scene = fakeScene();
    const reticle = new GroundTargetReticle(asScene(scene));
    const gfx = reticle.worldGraphics() as unknown as FakeGameObject;
    reticle.updatePosition(1, 1);
    expect(gfx.callsTo("fillCircle")).toHaveLength(0);
    reticle.showAt(0, 0, 10);
    expect(gfx.callsTo("lineStyle")[0]![1]).toBe(0xe8b04a);
    reticle.showAt(0, 0, 10, "default");
    expect(gfx.callsTo("lineStyle").at(-1)![1]).toBe(0xcbd5e1);
    reticle.hide();
    reticle.updatePosition(5, 5);
    expect(gfx.last("fillCircle")).toEqual([0, 0, 3]);
    reticle.destroy();
    expect(gfx.destroyed).toBe(true);
  });

  it("maps spells to reticle styles and scales radius by world scale", () => {
    expect(GroundTargetReticle.styleForSpellId("blizzard")).toBe("ice");
    for (const id of ["meteor", "flamestrike", "fire_blast"]) {
      expect(GroundTargetReticle.styleForSpellId(id)).toBe("fire");
    }
    expect(GroundTargetReticle.styleForSpellId("heal")).toBe("default");
    expect(GroundTargetReticle.radiusForSpell(asScene(fakeScene()), 40)).toBe(
      40,
    );
  });
});

describe("TargetIndicator", () => {
  it("bobs above the target, follows it while attached and hides on detach", () => {
    const scene = fakeScene();
    const ind = new TargetIndicator(asScene(scene), 30);
    const root = ind.worldRoot() as unknown as FakeGameObject;
    expect(root.visible).toBe(false);
    const bobTween = scene.tweenConfigs[0]!;
    expect(bobTween).toMatchObject({ y: -38, yoyo: true, repeat: -1 });

    const target = { x: 50, y: 60 };
    ind.attachTo(target as never);
    expect(root.visible).toBe(true);
    ind.updateWorldPosition();
    expect(root.last("setPosition")).toEqual([50, 60]);
    target.x = 70;
    ind.updateWorldPosition();
    expect(root.last("setPosition")).toEqual([70, 60]);

    ind.detach();
    expect(root.visible).toBe(false);
    ind.updateWorldPosition();
    expect(root.callsTo("setPosition")).toHaveLength(2);
    ind.destroy();
    expect(root.destroyed).toBe(true);
  });
});

describe("CastBar", () => {
  it("positions under the player and fills proportionally (clamped)", () => {
    const scene = fakeScene();
    const bar = new CastBar(asScene(scene));
    const [bg, fill] = bar.worldRoots() as unknown as FakeGameObject[];
    expect(bg!.last("setDepth")).toEqual([DEFENSE_RENDER_DEPTH.castBarBg]);
    bar.setWorldPosition(100, 100);
    expect(bg!.last("setPosition")).toEqual([100, 100 + CAST_BAR.offsetY]);
    expect(fill!.last("setPosition")).toEqual([
      100 - CAST_BAR.width / 2 + 1,
      100 + CAST_BAR.offsetY,
    ]);
    bar.setProgress(0.5);
    expect(fill!.width).toBeCloseTo((CAST_BAR.width - 2) * 0.5);
    bar.setProgress(3);
    expect(fill!.width).toBeCloseTo(CAST_BAR.width - 2);
    bar.setProgress(-1);
    expect(fill!.width).toBe(0);
  });

  it("recolours only on phase change; visibility and destroy cover both bars", () => {
    const scene = fakeScene();
    const bar = new CastBar(asScene(scene));
    const [bg, fill] = bar.worldRoots() as unknown as FakeGameObject[];
    bar.setPhase("windup");
    expect(fill!.callsTo("setFillStyle")).toHaveLength(0);
    bar.setPhase("channeling");
    expect(fill!.last("setFillStyle")).toEqual([
      CAST_BAR.channeling.fillColor,
      CAST_BAR.fillAlpha,
    ]);
    expect(bg!.last("setStrokeStyle")).toEqual([
      1,
      CAST_BAR.channeling.borderColor,
      0.9,
    ]);
    bar.setVisible(true);
    expect([bg!.visible, fill!.visible]).toEqual([true, true]);
    bar.destroy();
    expect([bg!.destroyed, fill!.destroyed]).toEqual([true, true]);
  });
});

describe("createCombatHudChrome", () => {
  it("covers the top chrome and bottom HUD band, leaving the play area clear", () => {
    const scene = fakeScene();
    const safe = { top: 0, right: 0, bottom: 0, left: 0 };
    const chrome = createCombatHudChrome(asScene(scene), safe, 40);
    const [top, bottom, border] = chrome.roots as unknown as FakeGameObject[];
    const topH = defenseTopChromeHeight(0);
    const play = defensePlayAreaLayout(asScene(scene), safe);
    expect(top!.args).toEqual([270, topH / 2, 540, topH, 0x15110f, 0.96]);
    const bottomH = 1200 - play.bottomBandTop;
    expect(bottom!.args).toEqual([
      270,
      play.bottomBandTop + bottomH / 2,
      540,
      bottomH,
      0x15110f,
      0.96,
    ]);
    expect(border!.last("setDepth")).toEqual([41]);
    expect(border!.callsTo("strokeRect")).toHaveLength(2);
    chrome.setVisible(false);
    expect(
      chrome.roots.every(
        (r) => (r as unknown as FakeGameObject).visible === false,
      ),
    ).toBe(true);
  });
});

describe("uiRoundedRect", () => {
  it("paints a centred rounded rect and repaints with new colours", () => {
    const scene = fakeScene();
    const g = createUiRoundedRect(
      asScene(scene),
      100,
      40,
      0x111111,
      0x222222,
      6,
    );
    const fake = g as unknown as FakeGameObject;
    expect(isUiRoundedRect(g)).toBe(true);
    expect(fake.last("fillRoundedRect")).toEqual([-50, -20, 100, 40, 6]);
    expect(fake.last("fillStyle")).toEqual([0x111111, 1]);
    paintUiRoundedRect(g, 0x333333);
    expect(fake.last("fillStyle")).toEqual([0x333333, 1]);
    expect(g.__uiRounded.stroke).toBe(0x222222);
    expect(isUiRoundedRect(asScene(scene).add.graphics())).toBe(false);
  });
});

describe("screenLayoutCore", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("safe insets are zero without a DOM; HUD band grows with the top inset", () => {
    expect(readSafeInsets()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(hudBandHeight(20) - hudBandHeight(0)).toBe(20);
  });

  it("reads env() insets from a probe element when a DOM exists", () => {
    const el = { style: { cssText: "" }, remove: vi.fn() };
    vi.stubGlobal("document", {
      createElement: () => el,
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal("getComputedStyle", () => ({
      top: "44px",
      right: "0px",
      bottom: "34px",
      left: "",
    }));
    expect(readSafeInsets()).toEqual({
      top: 44,
      right: 0,
      bottom: 34,
      left: 0,
    });
    expect(el.style.cssText).toContain("env(safe-area-inset-top");
    expect(el.remove).toHaveBeenCalled();
  });

  it("binds the game parent to the visual viewport and unbinds cleanly", () => {
    const listeners = new Map<string, () => void>();
    const vvListeners = new Map<string, () => void>();
    const parent = { style: {} as Record<string, string> };
    vi.stubGlobal("document", {
      getElementById: (id: string) => (id === "game" ? parent : null),
    });
    vi.stubGlobal("window", {
      innerWidth: 1,
      innerHeight: 1,
      visualViewport: {
        width: 390,
        height: 700,
        offsetLeft: 0,
        offsetTop: 50,
        addEventListener: (e: string, fn: () => void) => vvListeners.set(e, fn),
        removeEventListener: (e: string) => vvListeners.delete(e),
      },
      addEventListener: (e: string, fn: () => void) => listeners.set(e, fn),
      removeEventListener: (e: string) => listeners.delete(e),
    });
    const game = {
      config: { parent: "missing" },
      scale: { setParentSize: vi.fn(), updateBounds: vi.fn() },
    };
    const unbind = bindViewportToScale(game as never);
    expect(game.scale.setParentSize).toHaveBeenCalledWith(390, 700);
    expect(parent.style).toMatchObject({
      position: "fixed",
      top: "50px",
      width: "390px",
      height: "700px",
    });
    expect([...vvListeners.keys()].sort()).toEqual(["resize", "scroll"]);
    listeners.get("resize")!();
    expect(game.scale.updateBounds).toHaveBeenCalledTimes(2);
    unbind();
    expect(listeners.size + vvListeners.size).toBe(0);
  });

  it("cameraWorldPoint delegates to the camera", () => {
    const camera = { getWorldPoint: vi.fn(() => ({ x: 1, y: 2 })) };
    expect(cameraWorldPoint(camera as never, 5, 6)).toEqual({ x: 1, y: 2 });
    expect(camera.getWorldPoint).toHaveBeenCalledWith(5, 6);
  });
});
