import { describe, expect, it, vi } from "vitest";
import { GAME } from "../../config";
import { scaleUiX } from "../../core/displayScale";
import { VIRTUAL_STICK_DRAG_THRESHOLD_PX } from "../../input/inputTuning";
import { defensePlayAreaLayout } from "../../ui/screenLayout";
import { spellById } from "../../content/spells";
import {
  DefenseGroundAim,
  type DefenseGroundAimHost,
} from "./DefenseGroundAim";
import { groundAimFromWorldPoint } from "./defenseGroundAimInput";

const safe = { top: 0, right: 0, bottom: 0, left: 0 };

function pointer(id: number, x: number, y: number, isDown = true) {
  return { id, x, y, isDown } as unknown as Phaser.Input.Pointer;
}

function makeHost(
  overrides: Partial<DefenseGroundAimHost> = {},
): DefenseGroundAimHost {
  const getWorldPoint = vi.fn((x: number, y: number) => ({ x, y }));
  const registry = new Map<string, unknown>();
  const scene = {
    scene: { key: "Defense" },
    scale: { width: GAME.width, height: GAME.height },
    cameras: { main: { getWorldPoint } },
    registry: {
      get: (key: string) => registry.get(key),
      set: (key: string, value: unknown) => {
        registry.set(key, value);
      },
    },
    events: { emit: vi.fn() },
  };
  return {
    scene: scene as unknown as DefenseGroundAimHost["scene"],
    player: { sprite: { x: 40, y: 200 } } as DefenseGroundAimHost["player"],
    stick: {
      setExternalBlock: vi.fn(),
    } as unknown as DefenseGroundAimHost["stick"],
    safe,
    groundReticle: {
      updatePosition: vi.fn(),
      showAt: vi.fn(),
      hide: vi.fn(),
    } as unknown as DefenseGroundAimHost["groundReticle"],
    pendingGroundCast: "meteor",
    groundAim: { x: 80, y: 0 },
    wu: (n: number) => n,
    beginSpellCast: vi.fn(),
    ...overrides,
  };
}

describe("DefenseGroundAim press-drag placement", () => {
  const scene = {
    scale: { width: GAME.width, height: GAME.height },
  } as Parameters<typeof defensePlayAreaLayout>[0];
  const play = defensePlayAreaLayout(scene, safe);
  const barX = play.x + play.width / 2;
  const barY = play.y + play.height + 20;
  const fieldX = play.x + play.width / 2;
  const fieldY = play.y + play.height / 2;
  const dragPx = scaleUiX(VIRTUAL_STICK_DRAG_THRESHOLD_PX) + 2;
  const expectedAim = (host: DefenseGroundAimHost, x: number, y: number) => {
    const def = spellById(host.pendingGroundCast ?? "meteor")!;
    return groundAimFromWorldPoint(
      host.player.sprite.x,
      host.player.sprite.y,
      x,
      y,
      host.wu(def.groundTargetMaxRangeWu ?? 240),
    );
  };

  it("treats a short press on the bar as a tap, not a place", () => {
    const host = makeHost();
    const aim = new DefenseGroundAim(host);
    const down = pointer(1, barX, barY);
    aim.onPointerDown(down);
    expect(aim.resolveRelease(pointer(1, barX, barY, false))).toBe("ignore");
    expect(host.beginSpellCast).not.toHaveBeenCalled();
  });

  it("places the spell at pointer release after a drag into the play area", () => {
    const host = makeHost();
    const aim = new DefenseGroundAim(host);
    aim.onPointerDown(pointer(1, barX, barY));
    aim.onPointerMove(pointer(1, fieldX, fieldY));
    expect(aim.resolveRelease(pointer(1, fieldX, fieldY, false))).toBe(
      "confirm",
    );
    aim.confirm(pointer(1, fieldX, fieldY, false));
    expect(host.beginSpellCast).toHaveBeenCalledWith("meteor");
    expect(host.pendingGroundCast).toBeNull();
    expect(host.groundAim).toEqual(expectedAim(host, fieldX, fieldY));
  });

  it("places on empty ground with no enemy involved", () => {
    const host = makeHost();
    const aim = new DefenseGroundAim(host);
    aim.onPointerDown(pointer(1, barX, barY));
    aim.onPointerMove(pointer(1, fieldX, fieldY));
    aim.confirm(pointer(1, fieldX, fieldY, false));
    expect(host.beginSpellCast).toHaveBeenCalledWith("meteor");
    expect(host.groundAim).toEqual(expectedAim(host, fieldX, fieldY));
  });

  it("cancels when a drag is released back on the bar", () => {
    const host = makeHost();
    const aim = new DefenseGroundAim(host);
    aim.onPointerDown(pointer(1, barX, barY));
    aim.onPointerMove(pointer(1, barX + dragPx, barY));
    expect(aim.resolveRelease(pointer(1, barX, barY, false))).toBe("cancel");
    expect(host.beginSpellCast).not.toHaveBeenCalled();
  });

  it("does not follow the pointer until the drag threshold is crossed", () => {
    const host = makeHost({ groundAim: { x: 80, y: 0 } });
    const aim = new DefenseGroundAim(host);
    const preview = host.groundAim;
    aim.onPointerDown(pointer(1, barX, barY));
    aim.onPointerMove(pointer(1, barX + 2, barY - 2));
    expect(host.groundAim).toEqual(preview);
    expect(host.groundReticle.updatePosition).not.toHaveBeenCalled();
  });
});
