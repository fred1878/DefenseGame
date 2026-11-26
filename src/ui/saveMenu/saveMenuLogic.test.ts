import { describe, expect, it } from "vitest";
import type { SaveSlotView } from "../../core/saveSlots";
import {
  applyDeleteResult,
  applyWriteResult,
  canDeleteSelected,
  canLoadSelected,
  canSaveToSelected,
  createSaveMenuState,
  reduceSaveMenu,
  saveMenuPrompt,
  selectedSlot,
} from "./saveMenuLogic";

const empty: SaveSlotView = { index: 0, name: "Slot 1", empty: true };
const filled: SaveSlotView = {
  index: 1,
  name: "Slot 2",
  empty: false,
  night: 3,
  gold: 120,
  savedAt: 1,
};
const slots: SaveSlotView[] = [
  empty,
  filled,
  { index: 2, name: "Slot 3", empty: true },
];

describe("saveMenuLogic", () => {
  it("starts on slot 1 with save enabled and load/delete disabled", () => {
    const state = createSaveMenuState(slots);
    expect(state.selected).toBe(0);
    expect(selectedSlot(state)).toEqual(empty);
    expect(canSaveToSelected(state)).toBe(true);
    expect(canLoadSelected(state)).toBe(false);
    expect(canDeleteSelected(state)).toBe(false);
    expect(saveMenuPrompt(state)).toBe("");
  });

  it("saves immediately into an empty slot", () => {
    const state = createSaveMenuState(slots);
    const result = reduceSaveMenu(state, { type: "requestSave" });
    expect(result.effect).toEqual({ type: "write", index: 0 });
    expect(result.state.confirm).toBeNull();
  });

  it("asks to confirm overwrite of an occupied slot, then writes", () => {
    let state = createSaveMenuState(slots);
    state = reduceSaveMenu(state, { type: "select", index: 1 }).state;
    expect(canLoadSelected(state)).toBe(true);
    const asked = reduceSaveMenu(state, { type: "requestSave" });
    expect(asked.effect.type).toBe("none");
    expect(asked.state.confirm).toBe("overwrite");
    expect(saveMenuPrompt(asked.state)).toBe("Overwrite Slot 2?");
    const confirmed = reduceSaveMenu(asked.state, { type: "confirm" });
    expect(confirmed.effect).toEqual({ type: "write", index: 1 });
  });

  it("asks to confirm load and delete, and cancel clears the prompt", () => {
    let state = createSaveMenuState(slots);
    state = reduceSaveMenu(state, { type: "select", index: 1 }).state;
    const load = reduceSaveMenu(state, { type: "requestLoad" });
    expect(load.state.confirm).toBe("load");
    expect(saveMenuPrompt(load.state)).toBe(
      "Load Slot 2? Current game will be replaced.",
    );
    const cancelled = reduceSaveMenu(load.state, { type: "cancel" });
    expect(cancelled.state.confirm).toBeNull();
    expect(saveMenuPrompt(cancelled.state)).toBe("");

    const del = reduceSaveMenu(state, { type: "requestDelete" });
    expect(del.state.confirm).toBe("delete");
    expect(saveMenuPrompt(del.state)).toBe("Delete Slot 2?");
    const confirmed = reduceSaveMenu(del.state, { type: "confirm" });
    expect(confirmed.effect).toEqual({ type: "delete", index: 1 });
  });

  it("ignores load and delete on an empty slot", () => {
    const state = createSaveMenuState(slots);
    expect(reduceSaveMenu(state, { type: "requestLoad" }).effect.type).toBe(
      "none",
    );
    expect(reduceSaveMenu(state, { type: "requestDelete" }).effect.type).toBe(
      "none",
    );
  });

  it("selecting another slot clears an open confirm", () => {
    let state = createSaveMenuState(slots);
    state = reduceSaveMenu(state, { type: "select", index: 1 }).state;
    state = reduceSaveMenu(state, { type: "requestDelete" }).state;
    const next = reduceSaveMenu(state, { type: "select", index: 0 });
    expect(next.state.selected).toBe(0);
    expect(next.state.confirm).toBeNull();
  });

  it("applies write and delete results to the listed slots", () => {
    let state = createSaveMenuState(slots);
    const written: SaveSlotView = {
      index: 0,
      name: "Slot 1",
      empty: false,
      night: 7,
      gold: 50,
      savedAt: 9,
    };
    state = applyWriteResult(state, written);
    expect(state.slots[0]).toEqual(written);
    expect(state.status).toBe("Saved Slot 1");
    state = applyDeleteResult(state, 0);
    expect(state.slots[0]?.empty).toBe(true);
    expect(state.status).toBe("Deleted Slot 1");
  });
});

describe("saveMenuLogic leftover branches", () => {
  it("falls back to a generic name when the selected slot is missing", () => {
    const state = {
      ...createSaveMenuState(slots),
      selected: 99,
      confirm: "load" as const,
    };
    expect(saveMenuPrompt(state)).toContain("this slot");
  });

  it("ignores select, save, and confirm when the slot or confirm is invalid", () => {
    const state = createSaveMenuState(slots);
    expect(
      reduceSaveMenu(state, { type: "select", index: 99 }).effect.type,
    ).toBe("none");
    const confirming = {
      ...state,
      selected: 1,
      confirm: "delete" as const,
    };
    expect(
      reduceSaveMenu(confirming, { type: "requestSave" }).effect.type,
    ).toBe("none");
    expect(reduceSaveMenu(state, { type: "confirm" }).effect.type).toBe("none");
  });

  it("uses a fallback slot name when deleting an unknown index", () => {
    const state = createSaveMenuState([]);
    const next = applyDeleteResult(state, 4);
    expect(next.status).toBe("Deleted Slot 5");
  });
});
