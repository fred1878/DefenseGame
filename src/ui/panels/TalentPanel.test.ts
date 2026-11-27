import { afterEach, describe, expect, it, vi } from "vitest";
import { createNewSave } from "../../core/save/GameState";
import type { SaveGame } from "../../core/save/saveTypes";
import { fakeEventData, fakePointer } from "../../test/fakeInput";
import { asScene, fakeScene, type FakeGameObject } from "../../test/fakeScene";
import { talentFixture } from "../../test/talentFixture";
import { TalentPanel } from "./TalentPanel";
import { talentIconKey } from "../talentPanel/talentIcons";

type Internals = {
  learnBtn: { container: FakeGameObject };
  resetBtn: { container: FakeGameObject };
  closeBtn: { container: FakeGameObject };
  statusText: FakeGameObject;
  pointsPill: FakeGameObject;
  detailName: FakeGameObject;
  nodes: Array<{
    loc: { node: { id: string } };
    icon: FakeGameObject | null;
    hit: FakeGameObject;
    note: FakeGameObject;
    rank: FakeGameObject;
  }>;
};

function textOf(t: FakeGameObject): string {
  return String(t.last("setText")?.[0] ?? t.args[2] ?? "");
}

function openPanel(
  init: Partial<SaveGame> = {},
  opts: { textures?: string[]; fonts?: unknown } = {},
) {
  let save: SaveGame = {
    ...createNewSave(),
    talents: { ranks: {}, earned: 4 },
    gold: 100,
    ...init,
  };
  const scene = fakeScene({ textures: opts.textures ?? [] });
  const listeners = new Map<string, () => void>();
  const added: string[] = [];
  Object.assign(scene.textures, {
    addBase64: (key: string) => added.push(key),
    on: (ev: string, fn: () => void) => listeners.set(ev, fn),
    off: (ev: string) => listeners.delete(ev),
  });
  if (opts.fonts !== undefined)
    vi.stubGlobal("document", { fonts: opts.fonts });
  const onChange = vi.fn((next: SaveGame) => {
    save = next;
  });
  const onDismiss = vi.fn();
  const panel = new TalentPanel(
    asScene(scene),
    () => save,
    onChange,
    onDismiss,
    talentFixture(),
  );
  const ui = panel as unknown as Internals;
  const tap = (c: FakeGameObject) => {
    c.emit("pointerdown", fakePointer(0, 0, 1), 0, 0, fakeEventData());
    scene.input.hitTestPointer.mockReturnValueOnce([c]);
    scene.input.emit("pointerup", fakePointer(0, 0, 1));
  };
  const node = (id: string) => ui.nodes.find((n) => n.loc.node.id === id)!;
  return {
    panel,
    ui,
    scene,
    tap,
    node,
    onChange,
    onDismiss,
    listeners,
    added,
    save: () => save,
  };
}

describe("TalentPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects the first available talent and learns ranks", () => {
    const p = openPanel();
    expect(p.panel.selectedTalentId()).toBe("a1");
    expect(textOf(p.ui.pointsPill)).toBe("✦ 4 pts");
    p.tap(p.ui.learnBtn.container);
    p.tap(p.ui.learnBtn.container);
    expect(p.save().talents.ranks.a1).toBe(2);
    expect(textOf(p.ui.statusText)).toBe("Learned A One");
    expect(textOf(p.node("a1").rank)).toBe("2/2");
    // Maxed: learn explains why.
    p.tap(p.ui.learnBtn.container);
    expect(textOf(p.ui.statusText)).toBe("Maxed");
    expect(p.ui.learnBtn.container.alpha).toBe(0.45);
    // Pick one of tier II, the other shows "choice taken".
    p.node("a2y").hit.emit("pointerup");
    expect(p.panel.selectedTalentId()).toBe("a2y");
    p.tap(p.ui.learnBtn.container);
    expect(textOf(p.node("a2x").note)).toBe("choice taken");
    expect(p.panel.e2eTapTargets()["talents-node-a3"]).toBeTruthy();
  });

  it("explains missing points and locked tiers", () => {
    const p = openPanel({ talents: { ranks: {}, earned: 0 } });
    p.tap(p.ui.learnBtn.container);
    expect(textOf(p.ui.statusText)).toMatch(/No talent points/);
    const q = openPanel({ talents: { ranks: {}, earned: 3 } });
    q.node("a3").hit.emit("pointerup");
    q.tap(q.ui.learnBtn.container);
    expect(textOf(q.ui.statusText)).toBe("Needs 3 pts in Alpha");
    expect(q.onChange).not.toHaveBeenCalled();
  });

  it("resets after a confirm tap and charges gold", () => {
    const p = openPanel({ talents: { ranks: { a1: 1 }, earned: 4 } });
    expect(p.panel.e2eTapTargets()["talents-reset"]).toBeTruthy();
    p.tap(p.ui.resetBtn.container);
    expect(textOf(p.ui.statusText)).toMatch(/Tap again/);
    expect(p.onChange).not.toHaveBeenCalled();
    p.tap(p.ui.resetBtn.container);
    expect(p.save().talents.ranks).toEqual({});
    expect(p.save().gold).toBe(60);
    expect(textOf(p.ui.statusText)).toMatch(/reset/);
    // Nothing left to reset.
    p.tap(p.ui.resetBtn.container);
    expect(textOf(p.ui.statusText)).toBe("Nothing to reset");
  });

  it("refuses reset without enough gold", () => {
    const p = openPanel({ gold: 5, talents: { ranks: { a1: 1 }, earned: 4 } });
    expect(p.panel.e2eTapTargets()["talents-reset"]).toBeUndefined();
    p.tap(p.ui.resetBtn.container);
    expect(textOf(p.ui.statusText)).toBe("Reset costs 40g");
  });

  it("adds icons once their textures load", () => {
    const p = openPanel({}, { textures: [] });
    expect(p.added).toContain(talentIconKey("sword"));
    expect(talentIconKey("nope")).toBe("talent_icon_star");
    expect(p.node("a1").icon).toBeNull();
    (p.scene.textures as { exists: (k: string) => boolean }).exists = () =>
      true;
    p.listeners.get("addtexture")?.();
    expect(p.node("a1").icon).not.toBeNull();
    expect(p.node("a3").icon?.alpha).toBe(0.35);
  });

  it("re-renders Pixelify titles after the font loads; close dismisses", async () => {
    const load = vi.fn(async () => []);
    const p = openPanel({}, { fonts: { load } });
    expect(load).toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    p.tap(p.ui.closeBtn.container);
    expect(p.onDismiss).toHaveBeenCalledOnce();
    expect(p.listeners.has("addtexture")).toBe(false);
    p.panel.destroy();
    expect(p.onDismiss).toHaveBeenCalledOnce();
    p.listeners.get("addtexture")?.();
  });

  it("ignores a font load that finishes after close or fails", async () => {
    let resolve!: () => void;
    const p = openPanel(
      {},
      { fonts: { load: () => new Promise<void>((r) => (resolve = r)) } },
    );
    p.panel.destroy();
    resolve();
    await Promise.resolve();
    const q = openPanel({}, { fonts: { load: async () => Promise.reject(1) } });
    await Promise.resolve();
    expect(q.onDismiss).not.toHaveBeenCalled();
    openPanel({}, { fonts: {} });
  });
});
