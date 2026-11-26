import { afterEach, describe, expect, it, vi } from "vitest";
import { createNewSave } from "../core/GameState";
import { deleteSaveSlot, writeSaveSlot } from "../core/saveSlots";
import { fakePointer, fakeEventData } from "../test/fakeInput";
import { asScene, fakeScene, type FakeGameObject } from "../test/fakeScene";
import * as touchButton from "./touchButton";
import { SaveMenuPanel } from "./SaveMenuPanel";

type Internals = {
  state: { selected: number; confirm: string | null; status: string };
  saveBtn: { container: FakeGameObject };
  loadBtn: { container: FakeGameObject };
  deleteBtn: { container: FakeGameObject };
  confirmBtn: { container: FakeGameObject };
  cancelBtn: { container: FakeGameObject };
  closeBtn: { container: FakeGameObject };
  rows: Array<{ index: number; bg: FakeGameObject; meta: FakeGameObject }>;
  root: FakeGameObject;
};

function stubStorage(): void {
  const items = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => {
      items.set(k, v);
    },
    removeItem: (k: string) => {
      items.delete(k);
    },
  });
}

function openPanel(save = createNewSave()) {
  const scene = fakeScene();
  const onLoad = vi.fn();
  const onDismiss = vi.fn();
  const panel = new SaveMenuPanel(
    asScene(scene),
    () => save,
    onLoad,
    onDismiss,
  );
  const ui = panel as unknown as Internals;
  const tapButton = (c: FakeGameObject) => {
    c.emit("pointerdown", fakePointer(0, 0, 1), 0, 0, fakeEventData());
    scene.input.hitTestPointer.mockReturnValueOnce([c]);
    scene.input.emit("pointerup", fakePointer(0, 0, 1));
  };
  return { panel, ui, onLoad, onDismiss, tapButton };
}

describe("SaveMenuPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists five slots, saves into the first, and exposes e2e targets", () => {
    stubStorage();
    const save = createNewSave();
    save.night = 5;
    save.gold = 33;
    const { panel, ui, tapButton } = openPanel(save);
    expect(ui.rows).toHaveLength(5);
    expect(panel.e2eSlotMeta(0)).toBe("Empty");
    expect(ui.loadBtn.container.alpha).toBe(0.45);

    tapButton(ui.saveBtn.container);
    expect(panel.e2eSlotMeta(0)).toContain("Night 5 · 33g");
    expect(ui.state.status).toBe("Saved Slot 1");

    const targets = panel.e2eTapTargets();
    expect(targets["save-menu-close"]).toBeTruthy();
    expect(targets["save-menu-save"]).toBeTruthy();
    expect(targets["save-menu-slot-0"]).toBeTruthy();
    expect(targets["save-menu-confirm"]).toBeUndefined();
  });

  it("confirms overwrite, load and delete; close dismisses", () => {
    stubStorage();
    const current = createNewSave();
    current.night = 2;
    current.gold = 10;
    writeSaveSlot(
      1,
      Object.assign(createNewSave(), { night: 8, gold: 200 }),
      50,
    );
    const { panel, ui, onLoad, onDismiss, tapButton } = openPanel(current);

    ui.rows[1]!.bg.emit("pointerup");
    expect(ui.state.selected).toBe(1);
    expect(panel.e2eSlotMeta(1)).toContain("Night 8 · 200g");

    tapButton(ui.saveBtn.container);
    expect(ui.state.confirm).toBe("overwrite");
    expect(ui.confirmBtn.container.visible).toBe(true);
    tapButton(ui.confirmBtn.container);
    expect(panel.e2eSlotMeta(1)).toContain("Night 2 · 10g");

    tapButton(ui.loadBtn.container);
    expect(ui.state.confirm).toBe("load");
    tapButton(ui.confirmBtn.container);
    expect(onLoad).toHaveBeenCalledOnce();
    expect(onLoad.mock.calls[0]?.[0]).toMatchObject({ night: 2, gold: 10 });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("deletes an occupied slot after confirm and closes from the close button", () => {
    stubStorage();
    writeSaveSlot(0, Object.assign(createNewSave(), { night: 3, gold: 1 }), 1);
    const { panel, ui, onDismiss, tapButton } = openPanel();
    expect(panel.e2eSlotMeta(0)).toContain("Night 3 · 1g");
    tapButton(ui.deleteBtn.container);
    expect(ui.state.confirm).toBe("delete");
    tapButton(ui.confirmBtn.container);
    expect(panel.e2eSlotMeta(0)).toBe("Empty");
    expect(ui.state.status).toBe("Deleted Slot 1");
    tapButton(ui.closeBtn.container);
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("SaveMenuPanel leftover branches", () => {
  it("reports an empty meta line for a missing slot index", () => {
    stubStorage();
    const { panel } = openPanel();
    expect(panel.e2eSlotMeta(99)).toBe("");
  });

  it("refreshes with a warning when a slot vanishes mid-load", () => {
    stubStorage();
    writeSaveSlot(0, Object.assign(createNewSave(), { night: 4, gold: 7 }), 1);
    const { panel, ui, onLoad, tapButton } = openPanel();
    tapButton(ui.loadBtn.container);
    expect(ui.state.confirm).toBe("load");
    deleteSaveSlot(0);
    tapButton(ui.confirmBtn.container);
    expect(onLoad).not.toHaveBeenCalled();
    expect(ui.state.status).toBe("That save is no longer available.");
    expect(panel.e2eSlotMeta(0)).toBe("Empty");
  });

  it("destroy skips an inactive root and is a no-op the second time", () => {
    stubStorage();
    const { panel, ui, onDismiss } = openPanel();
    ui.root.active = false;
    panel.destroy();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    panel.destroy();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("SaveMenuPanel refresh leftover branches", () => {
  it("skips a row whose slot is missing from the current state", () => {
    stubStorage();
    const { ui } = openPanel();
    const box = ui as unknown as {
      state: { slots: unknown[] };
      refresh: () => void;
    };
    box.state.slots = [];
    box.refresh();
  });

  it("omits e2e targets when the buttons have no screen rect", () => {
    stubStorage();
    const { panel } = openPanel();
    const rect = vi
      .spyOn(touchButton, "interactiveObjectScreenRect")
      .mockReturnValue(null);
    const targets = panel.e2eTapTargets();
    expect(targets["save-menu-save"]).toBeUndefined();
    expect(targets["save-menu-close"]).toBeUndefined();
    expect(
      Object.keys(targets).every((k) => k.startsWith("save-menu-slot-")),
    ).toBe(true);
    rect.mockRestore();
  });
});
