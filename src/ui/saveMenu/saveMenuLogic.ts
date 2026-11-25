import type { SaveSlotView } from "../../core/saveSlots";

export type SaveMenuConfirmKind = "overwrite" | "load" | "delete";

export type SaveMenuState = {
  slots: SaveSlotView[];
  selected: number;
  confirm: SaveMenuConfirmKind | null;
  status: string;
};

export type SaveMenuCommand =
  | { type: "select"; index: number }
  | { type: "requestSave" }
  | { type: "requestLoad" }
  | { type: "requestDelete" }
  | { type: "confirm" }
  | { type: "cancel" };

export type SaveMenuEffect =
  | { type: "none" }
  | { type: "write"; index: number }
  | { type: "load"; index: number }
  | { type: "delete"; index: number };

export function createSaveMenuState(slots: SaveSlotView[]): SaveMenuState {
  return {
    slots,
    selected: 0,
    confirm: null,
    status: "",
  };
}

export function selectedSlot(state: SaveMenuState): SaveSlotView | undefined {
  return state.slots[state.selected];
}

export function canSaveToSelected(state: SaveMenuState): boolean {
  return state.confirm === null && selectedSlot(state) !== undefined;
}

export function canLoadSelected(state: SaveMenuState): boolean {
  const slot = selectedSlot(state);
  return state.confirm === null && slot !== undefined && !slot.empty;
}

export function canDeleteSelected(state: SaveMenuState): boolean {
  return canLoadSelected(state);
}

export function saveMenuPrompt(state: SaveMenuState): string {
  const slot = selectedSlot(state);
  const name = slot?.name ?? "this slot";
  if (state.confirm === "overwrite") return `Overwrite ${name}?`;
  if (state.confirm === "load") {
    return `Load ${name}? Current game will be replaced.`;
  }
  if (state.confirm === "delete") return `Delete ${name}?`;
  return state.status;
}

function withStatus(state: SaveMenuState, status: string): SaveMenuState {
  return { ...state, confirm: null, status };
}

export function reduceSaveMenu(
  state: SaveMenuState,
  command: SaveMenuCommand,
): { state: SaveMenuState; effect: SaveMenuEffect } {
  if (command.type === "select") {
    const slot = state.slots[command.index];
    if (!slot) return { state, effect: { type: "none" } };
    return {
      state: {
        ...state,
        selected: command.index,
        confirm: null,
        status: "",
      },
      effect: { type: "none" },
    };
  }
  if (command.type === "cancel") {
    return {
      state: { ...state, confirm: null, status: "" },
      effect: { type: "none" },
    };
  }
  if (command.type === "requestSave") {
    const slot = selectedSlot(state);
    if (!slot || state.confirm !== null) {
      return { state, effect: { type: "none" } };
    }
    if (slot.empty) {
      return { state, effect: { type: "write", index: slot.index } };
    }
    return {
      state: { ...state, confirm: "overwrite", status: "" },
      effect: { type: "none" },
    };
  }
  if (command.type === "requestLoad") {
    const slot = selectedSlot(state);
    if (!slot || slot.empty || state.confirm !== null) {
      return { state, effect: { type: "none" } };
    }
    return {
      state: { ...state, confirm: "load", status: "" },
      effect: { type: "none" },
    };
  }
  if (command.type === "requestDelete") {
    const slot = selectedSlot(state);
    if (!slot || slot.empty || state.confirm !== null) {
      return { state, effect: { type: "none" } };
    }
    return {
      state: { ...state, confirm: "delete", status: "" },
      effect: { type: "none" },
    };
  }
  // confirm
  const slot = selectedSlot(state);
  if (!slot || state.confirm === null) {
    return { state, effect: { type: "none" } };
  }
  if (state.confirm === "overwrite") {
    return { state, effect: { type: "write", index: slot.index } };
  }
  if (state.confirm === "load") {
    return { state, effect: { type: "load", index: slot.index } };
  }
  return { state, effect: { type: "delete", index: slot.index } };
}

export function applyWriteResult(
  state: SaveMenuState,
  slot: SaveSlotView,
): SaveMenuState {
  const slots = state.slots.map((s) => (s.index === slot.index ? slot : s));
  return withStatus(
    { ...state, slots, selected: slot.index },
    `Saved ${slot.name}`,
  );
}

export function applyDeleteResult(
  state: SaveMenuState,
  index: number,
): SaveMenuState {
  const name = state.slots[index]?.name ?? saveMenuFallbackName(index);
  const slots = state.slots.map((s) =>
    s.index === index ? { index, name: s.name, empty: true as const } : s,
  );
  return withStatus({ ...state, slots, selected: index }, `Deleted ${name}`);
}

function saveMenuFallbackName(index: number): string {
  return `Slot ${index + 1}`;
}
