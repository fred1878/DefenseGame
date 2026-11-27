/** Shared harness for the town shop / inventory overlay panel tests. */
import { vi } from "vitest";
import type { SaveGame } from "../core/save/saveTypes";
import { asScene, fakeScene } from "./fakeScene";

type Panel = {
  e2eTapTargets(): Record<string, { x: number; y: number }>;
  destroy(): void;
};

export function openPanel<P extends Panel>(
  start: SaveGame,
  make: (
    scene: Phaser.Scene,
    getSave: () => SaveGame,
    onChange: (s: SaveGame) => void,
    onDismiss: () => void,
  ) => P,
  textures: string[] = ["ui_icons_24", "ui_icons_48", "ui_atk_circle"],
) {
  const scene = fakeScene({ textures });
  let save = start;
  const onChange = vi.fn((next: SaveGame) => {
    save = next;
  });
  const onDismiss = vi.fn();
  const panel = make(asScene(scene), () => save, onChange, onDismiss);
  const ids = () => Object.keys(panel.e2eTapTargets()).sort();
  /** Tap the hit zone behind an e2e id (fails loudly when missing). */
  const tap = (id: string) => {
    const at = panel.e2eTapTargets()[id];
    if (!at) throw new Error(`no tap target ${id}: ${ids().join(", ")}`);
    const zone = scene
      .made("rectangle")
      .filter(
        (z) =>
          z.x === at.x &&
          z.y === at.y &&
          (z.input as { enabled?: boolean } | undefined)?.enabled !== false,
      )
      .at(-1);
    zone!.emit("pointerup");
  };
  const texts = () =>
    scene
      .made("text")
      .filter((t) => t.visible !== false && !t.destroyed)
      .map(
        (t) =>
          (t.last("setText")?.[0] as string | undefined) ??
          String(t.args[2] ?? ""),
      );
  return {
    scene,
    panel,
    tap,
    ids,
    texts,
    onChange,
    onDismiss,
    save: () => save,
  };
}
