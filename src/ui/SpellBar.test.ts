import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFENSE_SPELL_BAR } from "../config";
import { spellGroundTapAutoCasts } from "../content/spellGroundTapCast";
import { getSpellCatalog } from "../content/spells";
import { spellUsesManualGroundAim } from "../content/spellTargeting";
import type { TapOrLongPressCallbacks } from "./touchButtonPress";

type FakeObj = Record<string, ReturnType<typeof vi.fn>> & {
  x: number;
  y: number;
  list: unknown[];
};

const bound: TapOrLongPressCallbacks[] = [];
const buttons: FakeObj[] = [];

function chainable(x = 0, y = 0): FakeObj {
  const obj = { x, y, list: [] } as unknown as FakeObj;
  for (const m of [
    "setStrokeStyle",
    "setFillStyle",
    "setScrollFactor",
    "setDepth",
    "setVisible",
    "setOrigin",
    "setAlpha",
    "setPosition",
    "setSize",
    "setDisplaySize",
    "destroy",
    "add",
    "bringToTop",
  ]) {
    obj[m] = vi.fn(() => obj);
  }
  return obj;
}

vi.mock("./screenLayout", () => ({
  readSafeInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  spellBarSlotCenter: (_s: unknown, _i: unknown, index: number) => ({
    x: 100 + index * 70,
    y: 1000,
  }),
}));

vi.mock("./touchButton", () => ({
  createTouchButton: (_s: unknown, x: number, y: number) => {
    const container = chainable(x, y);
    buttons.push(container);
    return { container };
  },
  bindTapOrLongPress: (
    _s: unknown,
    _o: unknown,
    cb: TapOrLongPressCallbacks,
  ) => {
    bound.push(cb);
  },
  interactiveObjectScreenRect: (o: FakeObj) => {
    if ((o as { skipRect?: boolean }).skipRect) return null;
    return {
      x: o.x - 30,
      y: o.y - 30,
      width: 60,
      height: 60,
    };
  },
}));

const { SpellBar } = await import("./SpellBar");

function fakeScene(existsIcon = false) {
  const rects: FakeObj[] = [];
  const images: FakeObj[] = [];
  const texture = { setFilter: vi.fn() };
  return {
    rects,
    images,
    scene: {
      textures: {
        exists: () => existsIcon,
        get: () => texture,
      },
      add: {
        rectangle: vi.fn((x: number, y: number) => {
          const r = chainable(x, y);
          rects.push(r);
          return r;
        }),
        image: vi.fn(() => {
          const img = chainable();
          images.push(img);
          return img;
        }),
      },
    } as unknown as Phaser.Scene,
  };
}

const catalog = getSpellCatalog();
const instant = catalog.find((d) => !spellUsesManualGroundAim(d))!;
const groundTap = catalog.find(
  (d) => spellUsesManualGroundAim(d) && spellGroundTapAutoCasts(d.id),
)!;
const cooldownSpell = catalog.find((d) => d.cooldownMs > 0)!;

function make(
  slots: string[],
  auto: string[] = [],
  cooldown = () => 0,
  options: { existsIcon?: boolean } = {},
) {
  const callbacks = {
    onCastRequest: vi.fn(),
    onAutoCastToggle: vi.fn(),
    onGroundCastArm: vi.fn(),
    onGroundCastCancel: vi.fn(),
  };
  const caster = { getCooldownRemaining: vi.fn(cooldown) };
  const { scene, rects, images } = fakeScene(options.existsIcon);
  const bar = new SpellBar(scene, slots, auto, caster as never, callbacks);
  return { bar, callbacks, rects, images, caster };
}

beforeEach(() => {
  bound.length = 0;
  buttons.length = 0;
});

describe("SpellBar", () => {
  it("creates one button per slot, padding empty slots", () => {
    const { bar } = make([instant.id]);
    expect(buttons).toHaveLength(DEFENSE_SPELL_BAR.slotCount);
    expect(bound).toHaveLength(DEFENSE_SPELL_BAR.slotCount);
    expect(bar.getUiContainers()).toHaveLength(DEFENSE_SPELL_BAR.slotCount);
  });

  it("tap casts the slot's spell; empty slots do nothing", () => {
    const { callbacks } = make([instant.id]);
    bound[0]!.onTap();
    expect(callbacks.onCastRequest).toHaveBeenCalledWith(instant.id, 0);
    bound[1]!.onTap();
    expect(callbacks.onCastRequest).toHaveBeenCalledTimes(1);
  });

  it("long press cancels ground aim and toggles auto-cast", () => {
    const { callbacks } = make([instant.id]);
    bound[0]!.onLongPress();
    expect(callbacks.onGroundCastCancel).toHaveBeenCalled();
    expect(callbacks.onAutoCastToggle).toHaveBeenCalledWith(0);
  });

  it("targeted ground AoE arms on press and casts on short tap", () => {
    const { callbacks } = make([groundTap.id]);
    const pointer = { id: 1, x: 0, y: 0 };
    bound[0]!.onPressStart!(pointer as never);
    expect(callbacks.onGroundCastArm).toHaveBeenCalledWith(
      groundTap.id,
      pointer,
    );
    bound[0]!.onTap();
    expect(callbacks.onCastRequest).toHaveBeenCalledWith(groundTap.id, 0);
  });

  it("instant spells do not arm ground aim", () => {
    const { callbacks } = make([instant.id]);
    bound[0]!.onPressStart!({ id: 1, x: 0, y: 0 } as never);
    expect(callbacks.onGroundCastArm).not.toHaveBeenCalled();
  });

  it("shows auto-cast borders for auto slots and refreshes them", () => {
    const { bar, rects } = make([instant.id, cooldownSpell.id], [instant.id]);
    // Per slot: auto border then cooldown overlay.
    const border0 = rects[0]!;
    const border1 = rects[2]!;
    expect(border0.setVisible).toHaveBeenLastCalledWith(true);
    expect(border1.setVisible).toHaveBeenLastCalledWith(false);
    bar.refreshAutoCastBorders(
      [instant.id, cooldownSpell.id],
      [cooldownSpell.id],
    );
    expect(border0.setVisible).toHaveBeenLastCalledWith(false);
    expect(border1.setVisible).toHaveBeenLastCalledWith(true);
  });

  it("cooldown overlay covers the remaining fraction and dims the slot", () => {
    const remaining = cooldownSpell.cooldownMs / 2;
    const { bar, rects } = make([cooldownSpell.id], [], () => remaining);
    bar.refreshCooldownOverlays();
    const overlay0 = rects[1]!;
    expect(buttons[0]!.setAlpha).toHaveBeenLastCalledWith(0.45);
    expect(overlay0.setVisible).toHaveBeenLastCalledWith(true);
    expect(overlay0.setSize).toHaveBeenLastCalledWith(
      DEFENSE_SPELL_BAR.slotSizePx,
      DEFENSE_SPELL_BAR.slotSizePx / 2,
    );
    // Empty slot: never on cooldown.
    expect(buttons[1]!.setAlpha).toHaveBeenLastCalledWith(1);
  });

  it("screen rect spans all slots plus padding; e2e helpers report every slot", () => {
    const { bar } = make([instant.id]);
    const r = bar.getScreenRect();
    const n = DEFENSE_SPELL_BAR.slotCount;
    expect(r.width).toBeGreaterThan((n - 1) * 70 + 60);
    expect(bar.e2eSlotTapCenters()).toHaveLength(n);
    expect(bar.e2eSlotTapCenters()[0]).toEqual({ index: 0, x: 100, y: 1000 });
    expect(bar.e2eSlotHitRects()[1]).toEqual({
      index: 1,
      x: 140,
      y: 970,
      width: 60,
      height: 60,
    });
  });

  it("destroy removes overlays and borders", () => {
    const { bar, rects } = make([instant.id]);
    bar.destroy();
    for (const r of rects) expect(r.destroy).toHaveBeenCalled();
  });

  it("renders an icon when the spell texture exists", () => {
    const { images } = make([instant.id], [], () => 0, { existsIcon: true });
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]!.setDisplaySize).toHaveBeenCalled();
  });

  it("skips ground-arm and cooldown visuals when a slot is empty or missing", () => {
    const { bar, callbacks } = make([instant.id]);
    bound[1]!.onPressStart!({ id: 1, x: 0, y: 0 } as never);
    expect(callbacks.onGroundCastArm).not.toHaveBeenCalled();

    const privateBar = bar as unknown as {
      slots: Array<string | undefined>;
      slotChrome: Array<{ button?: unknown } | undefined>;
      cooldownVisuals: Array<unknown | undefined>;
    };
    privateBar.slots[0] = undefined;
    bound[0]!.onTap();
    bound[0]!.onPressStart!({ id: 2, x: 0, y: 0 } as never);
    expect(callbacks.onCastRequest).not.toHaveBeenCalled();

    privateBar.slotChrome[0] = {};
    privateBar.cooldownVisuals[0] = undefined;
    expect(() => bar.refreshCooldownOverlays()).not.toThrow();
  });

  it("returns an empty screen rect when no slot reports a hit area", () => {
    const { bar } = make([instant.id]);
    for (const btn of buttons) {
      (btn as { skipRect?: boolean }).skipRect = true;
    }
    expect(bar.getScreenRect()).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(bar.e2eSlotTapCenters()).toEqual([]);
    expect(bar.e2eSlotHitRects()).toEqual([]);
  });
});

describe("SpellBar leftover branches", () => {
  it("skips cooldown overlays when a slot has no chrome or unknown id", () => {
    const { bar } = make(["not-a-real-spell", cooldownSpell.id], [], () => 40);
    const box = bar as unknown as {
      slotChrome: Array<unknown>;
      refreshCooldownOverlays: () => void;
    };
    box.slotChrome.splice(1, 1);
    box.refreshCooldownOverlays();
  });
});

describe("SpellBar sparse-slot leftovers", () => {
  it("treats a hole in the slot list as empty", () => {
    const { bar } = make([instant.id]);
    const box = bar as unknown as {
      slots: Array<string | undefined>;
      refreshAutoCastBorders?: () => void;
      refreshCooldownOverlays: () => void;
    };
    delete box.slots[0];
    box.refreshCooldownOverlays();
  });
});
