import { describe, expect, it } from "vitest";
import bundled from "../../public/data/consumables.json";
import { createNewSave } from "../core/GameState";
import { normalizeConsumables } from "../core/normalizeConsumables";
import {
  consumableButtonState,
  consumableKindForKey,
  pickBombTarget,
} from "./consumableUse";

const config = normalizeConsumables(bundled);

describe("consumableUse", () => {
  it("hides with no charges and dims while cooling down", () => {
    const save = createNewSave();
    expect(consumableButtonState(save, "heal", 0, 0, config)).toEqual({
      visible: false,
      enabled: false,
      label: "Potion ×0",
    });
    save.consumables = { fire_bomb: 2, frost_bomb: 1 };
    expect(consumableButtonState(save, "bomb", 100, 500, config)).toEqual({
      visible: true,
      enabled: false,
      label: "Bomb ×3",
    });
    expect(consumableButtonState(save, "bomb", 500, 500).enabled).toBe(true);
  });

  it("targets the focused enemy in range, else the nearest", () => {
    const from = { x: 0, y: 0 };
    const enemies = [
      { id: "a", x: 100, y: 0 },
      { id: "b", x: 50, y: 0 },
      { id: "c", x: 500, y: 0 },
    ];
    expect(pickBombTarget(from, enemies, "a", 200)?.id).toBe("a");
    expect(pickBombTarget(from, enemies, "c", 200)?.id).toBe("b");
    expect(pickBombTarget(from, enemies, null, 200)?.id).toBe("b");
    expect(pickBombTarget(from, enemies, "zz", 10)).toBeNull();
    expect(pickBombTarget(from, [], null, 10)).toBeNull();
  });

  it("maps Q and E", () => {
    expect(consumableKindForKey("q")).toBe("heal");
    expect(consumableKindForKey("E")).toBe("bomb");
    expect(consumableKindForKey("x")).toBeNull();
  });
});
